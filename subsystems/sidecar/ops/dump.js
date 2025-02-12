'use strict'
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const parseLink = require('pear-api/parse-link')
const { ERR_PERMISSION_REQUIRED, ERR_DIR_NONEMPTY } = require('pear-api/errors')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const DriveMonitor = require('../lib/drive-monitor')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, dryRun, checkout, only, force, prune = !only }) {
    const { session, sidecar } = this
    await sidecar.ready()
    if (dir !== '-') {
      try {
        const files = await fsp.readdir(dir)
        const empty = files.length === 0
        if (empty === false && !force) throw ERR_DIR_NONEMPTY('Dir is not empty. To overwrite: --force')
      } catch (err) {
        if (err.code !== 'ENOENT') throw err // if dir doesn't exist Localdrive will create it
      }
    }

    const parsed = parseLink(link)
    const isFileLink = parsed.protocol === 'file:'
    const isFile = isFileLink && (await fsp.stat(parsed.pathname)).isDirectory() === false

    const key = parsed.drive.key
    checkout = Number(checkout)

    const query = await this.sidecar.model.getBundle(link)
    const encryptionKey = query?.encryptionKey

    const corestore = isFileLink ? null : sidecar._getCorestore(null, null)
    let drive = null

    if (corestore) {
      await corestore.ready()
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      }
    }
    const root = isFile ? path.dirname(parsed.pathname) : parsed.pathname
    const bundle = new Bundle({
      corestore,
      drive: isFileLink ? new LocalDrive(root, { followLinks: true }) : drive,
      key,
      checkout
    })

    await session.add(bundle)

    if (sidecar.swarm && !isFileLink) {
      bundle.join(sidecar.swarm)
      const monitor = new DriveMonitor(bundle.drive)
      this.on('end', () => monitor.destroy())
      monitor.on('error', (err) => this.push({ tag: 'stats-error', data: { err } }))
      monitor.on('data', (stats) => this.push({ tag: 'stats', data: stats }))
    }

    this.push({ tag: 'dumping', data: { link, dir } })

    if (dryRun) this.push({ tag: 'dry' })

    if (!isFileLink) {
      try {
        await bundle.calibrate()
      } catch (err) {
        await session.close()
        throw err
      }
    }

    const src = bundle.drive
    await src.ready()

    const prefix = isFileLink ? '/' : parsed.pathname
    const pathname = !isFileLink && parsed.pathname === '/'
      ? ''
      : (isFile ? path.basename(parsed.pathname) : prefix)
    const entry = pathname === '' ? null : await src.entry(pathname)
    if (dir === '-') {
      if (entry !== null) {
        const value = await src.get(entry)
        const key = entry.key.split('/').pop()
        this.push({ tag: 'file', data: { key, value } })
        return
      }

      for await (const entry of src.list(pathname)) {
        const value = await src.get(entry)
        const key = isFileLink ? entry.key : entry.key.slice(prefix.length)
        this.push({ tag: 'file', data: { key, value } })
      }
      return
    }

    const dst = new LocalDrive(dir)
    let select = null
    if (only) {
      only = Array.isArray(only) ? only : only.split(',').map((s) => s.trim())
      select = (key) => only.some((path) => key.startsWith(path[0] === '/' ? path : '/' + path))
    }
    const extraOpts = entry === null ? { prefix, filter: select } : { filter: select || ((key) => key === prefix) }
    const mirror = src.mirror(dst, { dryRun, prune, ...extraOpts })
    for await (const diff of mirror) {
      if (diff.op === 'add') {
        this.push({ tag: 'byte-diff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'change') {
        this.push({ tag: 'byte-diff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'remove') {
        this.push({ tag: 'byte-diff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } })
      }
    }
  }
}
