'use strict'
const LocalDrive = require('localdrive')
const Mirror = require('mirror-drive')
const unixPathResolve = require('unix-path-resolve')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_INPUT } = require('pear-errors')
const plink = require('pear-link')
const ReadyResource = require('ready-resource')
const fs = require('bare-fs')
const path = require('bare-path')
const Opstream = require('../lib/opstream')
const Hyperdrive = require('hyperdrive')

module.exports = class Stage extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, dir, dryRun, truncate, ignore, purge, only }) {
    const { session, sidecar } = this
    const parsed = link ? plink.parse(link) : null
    if (parsed === null || parsed.drive?.key === null) {
      throw ERR_INVALID_INPUT('A valid pear link must be specified')
    }

    const { dir: pkgDir, pkg } = await localPkg(dir)
    if (pkg === null) {
      throw ERR_INVALID_PROJECT_DIR(
        `"package.json not found from: ${dir}. Pear project must have a package.json`
      )
    }

    const options = pkg?.pear ?? {}

    await sidecar.ready()

    const key = parsed.drive.key
    const corestore = sidecar.getCorestore({ writable: true })
    await corestore.ready()

    const drive = await session.add(new Hyperdrive(corestore, key))

    if (Number.isInteger(truncate)) {
      await drive.truncate(truncate)
    }

    const currentVersion = drive.version
    const verlink = plink.serialize({
      drive: { length: drive.core.length, fork: drive.core.fork, key: drive.key }
    })

    if (ignore) ignore = Array.isArray(ignore) ? ignore : ignore.split(',')
    else ignore = []
    if (options?.stage?.ignore) ignore.push(...options.stage?.ignore)
    ignore = [...new Set(ignore)]

    only = Array.isArray(only) ? only : only?.split(',').map((s) => s.trim()) || []
    const cfgOnly = options?.stage?.only
    if (cfgOnly) {
      only.push(
        ...(Array.isArray(cfgOnly) ? cfgOnly : cfgOnly?.split(',').map((s) => s.trim()) || [])
      )
    }

    const applink = plink.serialize(drive.key)
    const z32 = applink.slice(7)

    this.push({
      tag: 'staging',
      data: {
        name: pkg?.pear?.name ?? pkg?.name ?? null,
        key: z32,
        link: applink,
        verlink: verlink,
        current: currentVersion,
        dir: pkgDir
      }
    })

    if (dryRun) this.push({ tag: 'dry' })
    const src = new LocalDrive(pkgDir, {
      followExternalLinks: true
    })

    const glob = new GlobDrive(src, ignore)
    await glob.ready()
    const ignored = glob.ignorer()
    const dst = drive

    const prefix = only.length > 0 ? [...new Set(only)] : undefined

    const opts = { prefix, ignore: ignored, dryRun, dedup: true, batch: true }

    if (!purge && options?.stage?.purge) purge = options?.stage?.purge
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

    if (dryRun) {
      this.push({ tag: 'skipping', data: { reason: 'dry-run', success: true } })
    }

    this.push({ tag: 'complete', data: { dryRun } })

    if (dryRun) return

    this.push({
      tag: 'addendum',
      data: {
        version: drive.version,
        key: z32,
        link: applink,
        verlink: plink.serialize({
          drive: { length: drive.core.length, fork: drive.core.fork, key: drive.key }
        })
      }
    })
  }
}

async function localPkg(dir) {
  try {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(dir, 'package.json')))
    return { dir, pkg }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EISDIR' && err.code !== 'ENOTDIR') throw err
    const parent = path.dirname(dir)
    if (parent === dir || path.resolve(dir) === path.resolve(parent)) {
      return { dir: null, pkg: null }
    }
    return localPkg(parent)
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
        cleanPattern.indexOf('**') !== -1 ? cleanPattern.indexOf('**') : cleanPattern.indexOf('*')
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
