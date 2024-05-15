'use strict'
const { spawn } = require('bare-subprocess')
const { once } = require('bare-events')
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Mirror = require('mirror-drive')
const unixPathResolve = require('unix-path-resolve')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Opstream = require('../lib/opstream')
const Bundle = require('../lib/bundle')
const State = require('../state')
const { BOOT, SWAP, DESKTOP_RUNTIME } = require('../../../constants')
const { ERR_TRACER_FAILED } = require('../../../errors')

module.exports = class Stage extends Opstream {
  static async * trace (bundle, client) {
    await bundle.ready()
    const tracer = bundle.startTracing()
    const sp = spawn(
      DESKTOP_RUNTIME,
      [BOOT, `--trace=${client.id}`, '--swap', SWAP, 'pear://' + hypercoreid.encode(bundle.drive.key)]
    )

    const onclose = () => sp.kill()
    client.on('close', onclose)

    const closed = once(sp, 'exit')
    client.off('close', onclose)

    const total = bundle.drive.core.length + (bundle.drive.blobs?.core.length || 0)
    for await (const { blocks } of tracer) yield { total, blocks }

    const [status] = await closed

    if (status) {
      const err = ERR_TRACER_FAILED('Tracer Failed!')
      err.exitCode = status
      throw err
    }

    await bundle.finalizeTracing()
  }

  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ channel, key, dir, dryRun, name, truncate, bare = false, clientArgv, ignore = '.git,.github,.DS_Store' }) {
    const { client, session, sidecar } = this
    const state = new State({
      id: `stager-${randomBytes(16).toString('hex')}`,
      flags: { channel, stage: true },
      dir,
      clientArgv
    })
    await sidecar.ready()
    if (key) key = hypercoreid.decode(key)

    const corestore = sidecar._getCorestore(name || state.name, channel, { writable: true })
    const bundle = new Bundle({
      key,
      corestore,
      channel,
      truncate,
      stage: true,
      failure (err) { console.error(err) }
    })
    await session.add(bundle)
    client.userData = new sidecar.App({ state, bundle })

    const currentVersion = bundle.version
    await state.initialize({ bundle, dryRun })
    const z32 = hypercoreid.encode(bundle.drive.key)
    await sidecar.trust({ z32 }, client)
    const type = state.manifest.pear?.type || 'desktop'
    const terminalBare = type === 'terminal'
    if (terminalBare) bare = true
    if (state.manifest.pear?.stage?.ignore) ignore = state.manifest.pear.stage?.ignore
    else ignore = (Array.isArray(ignore) ? ignore : ignore.split(','))

    ignore = ignore.map((file) => unixPathResolve('/', file))
    const release = (await bundle.db.get('release'))?.value || 0
    const pearkey = 'pear://' + z32

    this.push({ tag: 'staging', data: { name: state.name, channel: bundle.channel, key: pearkey, current: currentVersion, release } })

    if (dryRun) this.push({ tag: 'dry' })

    const root = unixPathResolve(state.dir)
    const main = unixPathResolve('/', state.main)
    const src = new LocalDrive(root, { followLinks: bare === false, metadata: new Map() })
    const dst = bundle.drive
    const opts = { filter: (key) => ignore.some((path) => key.startsWith(path)) === false, dryRun, batch: true }
    const builtins = terminalBare ? sidecar.linkerConfig.bareBuiltins : sidecar.linkerConfig.builtins
    const linker = new ScriptLinker(src, { builtins })
    const entrypoints = [main, ...(state.manifest.pear?.stage?.entrypoints || [])].map((entry) => unixPathResolve('/', entry))
    const mods = await linker.warmup(entrypoints)
    for await (const [filename, mod] of mods) src.metadata.put(filename, mod.cache())
    const mirror = new Mirror(src, dst, opts)
    for await (const diff of mirror) {
      if (diff.op === 'add') {
        this.push({ tag: 'byte-diff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'change') {
        this.push({ tag: 'byte-diff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'remove') {
        this.push({ tag: 'byte-diff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } })
      }
    }
    this.push({
      tag: 'summary',
      data: {
        files: mirror.count.files,
        add: mirror.count.add,
        remove: mirror.count.remove,
        change: mirror.count.change
      }
    })

    if (dryRun || bare) {
      const reason = dryRun ? 'dry-run' : 'bare'
      this.push({ tag: 'skipping', data: { reason, success: true } })
    } else if (mirror.count.add || mirror.count.remove || mirror.count.change) {
      for await (const { blocks, total } of this.constructor.trace(bundle, client)) {
        this.push({ tag: 'warming', data: { blocks, total } })
      }
      this.push({ tag: 'warming', data: { success: true } })
    } else {
      this.push({ tag: 'skipping', data: { reason: 'no changes', success: true } })
    }

    this.push({ tag: 'complete', data: { dryRun } })

    if (dryRun) return

    this.push({ tag: 'addendum', data: { version: bundle.version, release, channel, key: pearkey } })
  }
}
