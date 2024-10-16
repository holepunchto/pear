'use strict'
const { spawn } = require('bare-subprocess')
const { once } = require('bare-events')
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Mirror = require('mirror-drive')
const unixPathResolve = require('unix-path-resolve')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Opstream = require('../lib/opstream')
const Bundle = require('../lib/bundle')
const State = require('../state')
const Store = require('../lib/store')
const { BOOT, SWAP, DESKTOP_RUNTIME } = require('../../../constants')
const { ERR_TRACER_FAILED, ERR_INVALID_CONFIG, ERR_SECRET_NOT_FOUND, ERR_PERMISSION_REQUIRED } = require('../../../errors')

module.exports = class Stage extends Opstream {
  static async * trace (bundle, client) {
    await bundle.ready()
    const tracer = bundle.startTracing()
    const sp = spawn(
      DESKTOP_RUNTIME,
      [BOOT, '--no-sandbox', `--trace=${client.id}`, '--swap', SWAP, 'pear://' + hypercoreid.encode(bundle.drive.key)]
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

  async #op ({ channel, key, dir, dryRun, name, truncate, bare = false, cmdArgs, ignore = '.git,.github,.DS_Store', ...params }) {
    const { client, session, sidecar } = this
    const state = new State({
      id: `stager-${randomBytes(16).toString('hex')}`,
      flags: { channel, stage: true },
      dir,
      cmdArgs
    })

    await sidecar.ready()

    const corestore = sidecar._getCorestore(name || state.name, channel, { writable: true })
    await corestore.ready()

    key = key ? hypercoreid.decode(key) : await Hyperdrive.getDriveKey(corestore)

    const encrypted = state.options.encrypted

    if (!encrypted && params.encryptionKey) {
      const err = ERR_INVALID_CONFIG('pear.encrypted field is required in package.json')
      throw err
    }

    const permits = new Store('permits')
    const secrets = new Store('encryption-keys')
    const encryptionKeys = await permits.get('encryption-keys') || {}
    const encryptionKey = encryptionKeys[hypercoreid.normalize(key)] || await secrets.get(params.encryptionKey)

    if (encrypted === true && !encryptionKey && !params.encryptionKey) {
      throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
    }

    if (encrypted === true && !encryptionKey) {
      const err = ERR_SECRET_NOT_FOUND('Not found encryption key: ' + params.encryptionKey)
      throw err
    }

    const bundle = new Bundle({
      key,
      corestore,
      channel,
      truncate,
      stage: true,
      encryptionKey: encryptionKey ? Buffer.from(encryptionKey, 'hex') : null
    })
    await session.add(bundle)
    client.userData = new sidecar.App({ state, bundle })

    const currentVersion = bundle.version
    await state.initialize({ bundle, dryRun, name })

    await sidecar.permit({ key: bundle.drive.key, encryptionKey }, client)
    const type = state.manifest.pear?.type || 'desktop'
    const terminalBare = type === 'terminal'
    if (terminalBare) bare = true
    if (state.manifest.pear?.stage?.ignore) ignore = state.manifest.pear.stage?.ignore
    else ignore = (Array.isArray(ignore) ? ignore : ignore.split(','))
    const release = (await bundle.db.get('release'))?.value || 0
    const z32 = hypercoreid.encode(bundle.drive.key)
    const link = 'pear://' + z32
    this.push({ tag: 'staging', data: { name: state.name, channel: bundle.channel, key: z32, link, current: currentVersion, release } })

    if (dryRun) this.push({ tag: 'dry' })

    const root = state.dir
    const main = unixPathResolve('/', state.main)
    const src = new LocalDrive(root, { followLinks: bare === false, metadata: new Map() })
    const dst = bundle.drive
    const opts = { ignore, dryRun, batch: true }
    const builtins = terminalBare ? sidecar.gunk.bareBuiltins : sidecar.gunk.builtins
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
        change: mirror.count.change,
        length: mirror.dst.core.length,
        byteLength: mirror.dst.core.byteLength,
        blobs: mirror.dst.blobs
          ? {
              length: mirror.dst.blobs.core.length,
              fork: mirror.dst.blobs.core.fork,
              byteLength: mirror.dst.blobs.core.byteLength
            }
          : null
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

    this.push({ tag: 'addendum', data: { version: bundle.version, release, channel, key: z32, link } })
  }
}
