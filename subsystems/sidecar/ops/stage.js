'use strict'
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Mirror = require('mirror-drive')
const unixPathResolve = require('unix-path-resolve')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const DriveAnalyzer = require('drive-analyzer')
const { dirname } = require('bare-path')
const { ERR_INVALID_CONFIG, ERR_PERMISSION_REQUIRED } = require('pear-errors')
const plink = require('pear-link')
const Opstream = require('../lib/opstream')
const Pod = require('../lib/pod')
const State = require('../state')
const PearShake = require('pear-shake')
const ReadyResource = require('ready-resource')

module.exports = class Stage extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({
    channel,
    key,
    dir,
    dryRun,
    name,
    truncate,
    compact,
    cmdArgs,
    ignore,
    purge,
    only,
    pkg = null
  }) {
    const { client, session, sidecar } = this

    const state = new State({
      id: `stager-${randomBytes(16).toString('hex')}`,
      flags: { channel, stage: true },
      dir,
      cmdArgs
    })

    await sidecar.ready()

    if (name) state.name = name
    await State.build(state, pkg)

    const corestore = sidecar.getCorestore(state.name, channel, {
      writable: true
    })
    await corestore.ready()

    key = key
      ? hypercoreid.decode(key)
      : await Hyperdrive.getDriveKey(corestore)

    const encrypted = state.options.encrypted
    const traits = await this.sidecar.model.getTraits(
      `pear://${hypercoreid.encode(key)}`
    )
    const encryptionKey = traits?.encryptionKey

    if (encrypted === true && !encryptionKey) {
      throw new ERR_PERMISSION_REQUIRED('Encryption key required', {
        key,
        encrypted: true
      })
    }

    const pod = new Pod({
      key,
      corestore,
      channel,
      truncate,
      stage: true,
      encryptionKey
    })
    await session.add(pod)

    const currentVersion = pod.version
    const verlink = pod.verlink()
    await state.initialize({ pod, dryRun })

    await sidecar.permit({ key: pod.drive.key, encryptionKey }, client)
    const defaultIgnore = [
      '**.git',
      '**.github',
      '**.DS_Store',
      'node_modules/.package-lock.json'
    ]

    if (ignore) ignore = Array.isArray(ignore) ? ignore : ignore.split(',')
    else ignore = []
    if (state.options?.stage?.ignore)
      ignore.push(...state.options.stage?.ignore)
    ignore = [...new Set([...defaultIgnore, ...ignore])]

    only = Array.isArray(only)
      ? only
      : only?.split(',').map((s) => s.trim()) || []
    let cfgOnly = state.options?.stage?.only
    if (cfgOnly) {
      only.push(
        ...(Array.isArray(cfgOnly)
          ? cfgOnly
          : cfgOnly?.split(',').map((s) => s.trim()) || [])
      )
    }

    const release = (await pod.db.get('release'))?.value || 0

    const link = plink.serialize(pod.drive.key)
    const z32 = link.slice(7)

    this.push({
      tag: 'staging',
      data: {
        name: state.name,
        channel: pod.channel,
        key: z32,
        link,
        verlink: verlink,
        current: currentVersion,
        release,
        dir
      }
    })

    if (dryRun) this.push({ tag: 'dry' })
    const src = new LocalDrive(state.dir, {
      followExternalLinks: true,
      metadata: new Map()
    })
    const builtins = state.options.assets?.ui
      ? sidecar.gunk.builtins
      : sidecar.gunk.bareBuiltins
    const linker = new ScriptLinker(src, { builtins })

    const mainExists =
      (await src.entry(unixPathResolve('/', state.main))) !== null
    const entrypoints = [
      ...(mainExists ? [state.main] : []),
      ...(state.options?.stage?.entrypoints || [])
    ].map((entrypoint) => unixPathResolve('/', entrypoint))

    const include = [
      ...(state.options?.stage?.include || []),
      ...(state.options?.stage?.prefetch || [])
    ]

    for (const entrypoint of entrypoints) {
      const entry = await src.entry(entrypoint)
      if (!entry)
        throw ERR_INVALID_CONFIG(
          'Invalid main or stage entrypoint in package.json'
        )
    }

    const glob = new GlobDrive(src, ignore)
    await glob.ready()
    const ignored = glob.ignorer()
    // Cached versions of files and skips for warmup map generation,
    // preventing a second round of static analysis
    let compactFiles = null
    let compactSkips = null

    if (compact) {
      const pearShake = new PearShake(src, entrypoints)
      let shake = await pearShake.run({
        defer: state.options?.stage?.defer
      })
      compactFiles = shake.files
      compactSkips = shake.skips
      const { files } = shake
      const skips = shake.skips.map(({ specifier, referrer }) => {
        return { specifier, referrer: referrer.pathname }
      })
      let main = state.options?.gui?.main || null
      if (typeof main === 'string') {
        if (main.startsWith('/') === false) main = '/' + main
        only.push(main)
      }
      only.push(...files.filter((file) => !ignored(file)), ...include)
      this.push({
        tag: 'compact',
        data: { files: files, skips, success: true }
      })
    }

    const dst = pod.drive

    const prefix = only.length > 0 ? only : undefined

    const opts = { prefix, ignore: ignored, dryRun, batch: true }

    const mods = await linker.warmup(entrypoints)
    for await (const [filename, mod] of mods)
      src.metadata.put(filename, mod.cache())
    if (!purge && state.options?.stage?.purge)
      purge = state.options?.stage?.purge
    if (purge) {
      for await (const entry of dst) {
        if (ignored(entry.key)) {
          if (!dryRun) await dst.del(entry.key)
          this.push({
            tag: 'byte-diff',
            data: {
              type: -1,
              sizes: [-entry.value.blob.byteLength],
              message: entry.key
            }
          })
        }
      }
    }

    const mirror = new Mirror(src, dst, opts)
    for await (const diff of mirror) {
      if (diff.op === 'add') {
        this.push({
          tag: 'byte-diff',
          data: { type: 1, sizes: [diff.bytesAdded], message: diff.key }
        })
      } else if (diff.op === 'change') {
        this.push({
          tag: 'byte-diff',
          data: {
            type: 0,
            sizes: [-diff.bytesRemoved, diff.bytesAdded],
            message: diff.key
          }
        })
      } else if (diff.op === 'remove') {
        this.push({
          tag: 'byte-diff',
          data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key }
        })
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

    const isTemplate = (await pod.drive.entry('/_template.json')) !== null
    if (dryRun) {
      this.push({ tag: 'skipping', data: { reason: 'dry-run', success: true } })
    } else if (state.options?.stage?.skipWarmup) {
      this.push({
        tag: 'skipping',
        data: { reason: 'configured', success: true }
      })
    } else if (isTemplate) {
      this.push({
        tag: 'skipping',
        data: { reason: 'template', success: true }
      })
    } else if (mirror.count.add || mirror.count.remove || mirror.count.change) {
      const analyzer = new DriveAnalyzer(pod.drive)
      await analyzer.ready()
      const analyzed = await analyzer.analyze(entrypoints, include, {
        defer: state.options?.stage?.defer,
        files: compact ? await stagedFiles(pod.drive) : null,
        skips: compact ? compactSkips : null
      })
      const { warmup } = analyzed
      const skips = analyzed.skips.map(({ specifier, referrer }) => {
        return { specifier, referrer: referrer.pathname }
      })

      await pod.db.put('warmup', warmup)
      const total = pod.drive.core.length + (pod.drive.blobs?.core.length || 0)
      const blocks = warmup.meta.length + warmup.data.length
      this.push({
        tag: 'warmed',
        data: { total, blocks, skips: skips, success: true }
      })
    } else {
      this.push({
        tag: 'skipping',
        data: { reason: 'no changes', success: true }
      })
    }

    this.push({ tag: 'complete', data: { dryRun } })

    if (dryRun) return

    this.push({
      tag: 'addendum',
      data: {
        version: pod.version,
        release,
        channel,
        key: z32,
        link,
        verlink: pod.verlink()
      }
    })
  }
}

class GlobDrive extends ReadyResource {
  constructor(drive, globs) {
    super()
    this.drive = drive
    this.globs = globs
    this.ignores = null
    this.unignores = null
    this.ignore = null
  }

  async _open() {
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

      const idx =
        cleanPattern.indexOf('**') !== -1
          ? cleanPattern.indexOf('**')
          : cleanPattern.indexOf('*')
      const dir = idx !== -1 ? cleanPattern.slice(0, idx) : cleanPattern

      for await (const entry of this.drive.list(dir, {
        recursive: isRecursive
      })) {
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

  ignorer() {
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

// Lists all staged files without reprocessing ignore
async function stagedFiles(drive) {
  const files = []
  for await (const file of drive.list()) files.push(file)
  return files
}
