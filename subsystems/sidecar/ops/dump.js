'use strict'
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const plink = require('pear-link')
const {
  ERR_PERMISSION_REQUIRED,
  ERR_DIR_NONEMPTY,
  ERR_INVALID_INPUT,
  ERR_NOT_FOUND
} = require('pear-errors')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')

module.exports = class Dump extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, dir, dryRun, checkout, only, force, prune = !only, list }) {
    const { session, sidecar } = this
    if (list) dir = '-'
    if (!link) throw ERR_INVALID_INPUT('<link> must be specified.')
    if (!dir) throw ERR_INVALID_INPUT('<dir> must be specified.')
    await sidecar.ready()
    if (dir !== '-') {
      try {
        const files = await fsp.readdir(dir)
        const empty = files.length === 0
        if (empty === false && !force)
          throw ERR_DIR_NONEMPTY('Dir is not empty. To overwrite: --force')
      } catch (err) {
        if (err.code !== 'ENOENT') throw err // if dir doesn't exist Localdrive will create it
      }
    }

    const parsed = plink.parse(link)
    const isFileLink = parsed.protocol === 'file:'
    const isFile =
      isFileLink && (await fsp.stat(parsed.pathname)).isDirectory() === false

    const key = parsed.drive.key
    checkout =
      checkout || checkout === 0 ? Number(checkout) : parsed.drive.length

    const traits = await this.sidecar.model.getTraits(link)
    const encryptionKey = traits?.encryptionKey

    const corestore = isFileLink ? null : sidecar.getCorestore(null, null)
    let drive = null

    if (corestore) {
      await corestore.ready()
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw ERR_PERMISSION_REQUIRED('Encryption key required', {
          key,
          encrypted: true
        })
      }
    }
    const root = isFile ? path.dirname(parsed.pathname) : parsed.pathname
    const pod = new Pod({
      corestore,
      drive: isFileLink ? new LocalDrive(root, { followLinks: true }) : drive,
      key,
      checkout,
      swarm: sidecar.swarm
    })

    await session.add(pod)

    if (sidecar.swarm && !isFileLink) pod.join()

    this.push({ tag: 'dumping', data: { link, dir } })

    if (dryRun) this.push({ tag: 'dry' })

    if (!isFileLink) {
      try {
        await pod.calibrate({ isDump: true })
      } catch (err) {
        await session.close()
        throw err
      }
    }

    const src = pod.drive
    await src.ready()

    const prefix = isFileLink ? '/' : parsed.pathname
    const pathname =
      !isFileLink && parsed.pathname === '/'
        ? ''
        : isFile
          ? path.basename(parsed.pathname)
          : prefix
    const entry = pathname === '' ? null : await src.entry(pathname)

    if (entry === null) {
      let isDir = false
      for await (const entry of src.list(pathname)) {
        isDir = true
        break
      }
      if (!isDir) throw ERR_NOT_FOUND('not found', { link })
    }

    if (dir === '-') {
      if (entry !== null) {
        const key = entry.key.split('/').pop()
        const value = list ? null : await src.get(entry)
        const data = list ? { key } : { key, value }
        this.push({ tag: 'file', data })
        this.final = data
        return
      }

      for await (const entry of src.list(pathname)) {
        const key = isFileLink ? entry.key : entry.key.slice(prefix.length)
        if (list) {
          this.push({ tag: 'file', data: { key } })
          continue
        }
        const value = await src.get(entry)
        this.push({ tag: 'file', data: { key, value } })
      }
      return
    }

    const dst = new LocalDrive(dir)

    let prefixes = [prefix || '/']
    if (only) {
      prefixes = (Array.isArray(only) ? only : only.split(',')).map(
        (s) => (prefix.endsWith('/') ? prefix : prefix + '/') + s.trim()
      )
    }

    const mirror = src.mirror(dst, {
      progress: true,
      dryRun,
      prune,
      prefix: prefixes
    })
    if (!isFileLink) {
      const monitor = mirror.monitor()
      monitor.on('update', (stats) => this.push({ tag: 'stats', data: stats }))
    }

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
  }
}
