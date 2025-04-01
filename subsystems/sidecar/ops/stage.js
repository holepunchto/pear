'use strict'
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Mirror = require('mirror-drive')
const unixPathResolve = require('unix-path-resolve')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const DriveAnalyzer = require('drive-analyzer')
const { ERR_INVALID_CONFIG, ERR_PERMISSION_REQUIRED } = require('pear-api/errors')
const Opstream = require('../lib/opstream')
const Bundle = require('../lib/bundle')
const State = require('../state')

module.exports = class Stage extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ channel, key, dir, dryRun, name, truncate, cmdArgs, ignore = '.git,.github,.DS_Store', only }) {
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
    const persistedBundle = await this.sidecar.model.getBundle(`pear://${hypercoreid.encode(key)}`)
    const encryptionKey = persistedBundle?.encryptionKey

    if (encrypted === true && !encryptionKey) {
      throw ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
    }

    const bundle = new Bundle({
      key,
      corestore,
      channel,
      truncate,
      stage: true,
      encryptionKey
    })
    await session.add(bundle)

    const currentVersion = bundle.version
    await state.initialize({ bundle, dryRun, name })

    await sidecar.permit({ key: bundle.drive.key, encryptionKey }, client)
    if (state.options?.stage?.ignore) ignore = state.options.stage?.ignore
    else ignore = (Array.isArray(ignore) ? ignore : ignore.split(','))

    if (state.options?.stage?.only) only = state.options?.stage?.only
    else only = Array.isArray(only) ? only : only?.split(',').map((s) => s.trim())

    const release = (await bundle.db.get('release'))?.value || 0
    const z32 = hypercoreid.encode(bundle.drive.key)
    const link = 'pear://' + z32
    this.push({ tag: 'staging', data: { name: state.name, channel: bundle.channel, key: z32, link, current: currentVersion, release, dir } })

    if (dryRun) this.push({ tag: 'dry' })

    const src = new LocalDrive(dir, { followExternalLinks: true, metadata: new Map() })
    const dst = bundle.drive
    const select = only
      ? (key) => only.some((path) => key.startsWith(path[0] === '/' ? path : '/' + path))
      : null

    const opts = { ignore, dryRun, batch: true, filter: select }
    const builtins = sidecar.gunk.bareBuiltins
    const linker = new ScriptLinker(src, { builtins })

    const mainExists = await src.entry(unixPathResolve('/', state.main)) !== null
    const entrypoints = [
      ...(mainExists ? [state.main] : []),
      ...(state.options?.stage?.entrypoints || [])
    ].map(entrypoint => unixPathResolve('/', entrypoint))

    for (const entrypoint of entrypoints) {
      const entry = await src.entry(entrypoint)
      if (!entry) throw ERR_INVALID_CONFIG('Invalid main or stage entrypoint in package.json')
    }

    const mods = await linker.warmup(entrypoints)
    for await (const [filename, mod] of mods) src.metadata.put(filename, mod.cache())
    if (!purge && state.manifest.pear?.stage?.purge) purge = state.manifest.pear?.stage?.purge
    if (purge) {
      for await (const entry of dst) {
        if (ignore.some(e => entry.key.startsWith('/' + e))) {
          if (!dryRun) await dst.del(entry.key)
          this.push({ tag: 'byte-diff', data: { type: -1, sizes: [-entry.value.blob.byteLength], message: entry.key } })
        }
      }
    }
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

    const isTemplate = (await bundle.drive.entry('/_template.json')) !== null
    if (dryRun) {
      this.push({ tag: 'skipping', data: { reason: 'dry-run', success: true } })
    } else if (state.options?.stage?.skipWarmup) {
      this.push({ tag: 'skipping', data: { reason: 'configured', success: true } })
    } else if (isTemplate) {
      this.push({ tag: 'skipping', data: { reason: 'template', success: true } })
    } else if (mirror.count.add || mirror.count.remove || mirror.count.change) {
      const analyzer = new DriveAnalyzer(bundle.drive)
      await analyzer.ready()
      const prefetch = state.options?.stage?.prefetch || []
      const warmup = await analyzer.analyze(entrypoints, prefetch)
      await bundle.db.put('warmup', warmup)
      const total = bundle.drive.core.length + (bundle.drive.blobs?.core.length || 0)
      const blocks = warmup.meta.length + warmup.data.length
      this.push({ tag: 'warming', data: { total, blocks, success: true } })
    } else {
      this.push({ tag: 'skipping', data: { reason: 'no changes', success: true } })
    }

    this.push({ tag: 'complete', data: { dryRun } })

    if (dryRun) return

    this.push({ tag: 'addendum', data: { version: bundle.version, release, channel, key: z32, link } })
  }
}
