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
const ReadyResource = require('ready-resource')

module.exports = class Stage extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ channel, key, dir, dryRun, name, truncate, cmdArgs, ignore, purge, only }) {
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
    const defaultIgnore = ['**.git', '**.github', '**.DS_Store']
    if (ignore) ignore = (Array.isArray(ignore) ? ignore : ignore.split(','))
    else ignore = []
    if (state.options?.stage?.ignore) ignore.push(...state.options.stage?.ignore)
    ignore = [...new Set([...ignore, ...defaultIgnore])]

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
    const glob = new GlobDrive(src, ignore)
    await glob.ready()

    const opts = { ignore: glob.ignorer(), dryRun, batch: true, filter: select }
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
    if (!purge && state.options?.stage?.purge) purge = state.options?.stage?.purge
    if (purge) {
      for await (const entry of dst) {
        if (glob.ignorer()(entry.key)) {
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

class GlobDrive extends ReadyResource {
  constructor (drive, globs) {
    super()
    this.drive = drive
    this.globs = globs
    this.ignores = null
    this.unignores = null
    this.ignore = null
  }

  async _open () {
    const isGlob = (str) => /[*?[\]{}()]/.test(str)
    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/\/+$/, '') // remove leading/trailing slashes

    const globToRegex = (glob) => {
      const normalized = normalizePath(glob)
      const placeholder = '__DOUBLE_STAR__'
      const regexStr = normalized
        .replace(/\*\*/g, placeholder)
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[^/]+')
        .replace(placeholder, '.*')
      return new RegExp(`^${regexStr}(?:/.*)?$`)
    }

    const ignores = new Set()
    const unignores = new Set()
    const globs = []

    for (const item of this.globs) {
      if (isGlob(item)) {
        globs.push(item)
      } else {
        const normalized = normalizePath(item)
        if (normalized.startsWith('!')) unignores.add(normalized.slice(1))
        else ignores.add(normalized)
      }
    }

    for (const pattern of globs) {
      const isNegated = pattern.startsWith('!')
      const isRecursive = pattern.includes('**')
      const cleanPattern = normalizePath(isNegated ? pattern.slice(1) : pattern)
      const matcher = globToRegex(cleanPattern)

      const idx = cleanPattern.indexOf('**') !== -1 ? cleanPattern.indexOf('**') : cleanPattern.indexOf('*')
      const dir = idx !== -1 ? cleanPattern.slice(0, idx) : cleanPattern

      for await (const entry of this.drive.list(dir, { recursive: isRecursive })) {
        const key = normalizePath(entry.key)
        if (matcher.test(key)) {
          if (isNegated) unignores.add(key)
          else ignores.add(key)
        }
      }
    }
    this.ignores = ignores
    this.unignores = unignores
  }

  ignorer () {
    if (this.ignore) return this.ignore
    this.ignore = (key) => {
      for (const u of this.unignores) {
        const path = unixPathResolve('/', u)
        if (path === key) return false
        if (path.startsWith(key + '/')) return false
        if (key.startsWith(path + '/')) return false
      }
      for (const i of this.ignores) {
        const path = unixPathResolve('/', i)
        if (path === key) return true
        if (key.startsWith(path + '/')) return true
      }
      return false
    }
    return this.ignore
  }
}
