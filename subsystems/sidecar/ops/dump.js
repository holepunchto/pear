'use strict'
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const LocalDrive = require('localdrive')
const Bundle = require('../lib/bundle')
const HyperDB = require('hyperdb')
const { PLATFORM_HYPERDB } = require('../../../constants')
const Opstream = require('../lib/opstream')
const parseLink = require('../../../lib/parse-link')
const Hyperdrive = require('hyperdrive')
const { ERR_PERMISSION_REQUIRED, ERR_DIR_NONEMPTY } = require('../../../errors')
const hypercoreid = require('hypercore-id-encoding')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, dryRun, checkout, encryptionKey, force }) {
    const { session, sidecar } = this
    await sidecar.ready()

    if (dir !== '-') {
      const files = await fsp.readdir(dir)
      const empty = files.length === 0
      if (empty === false && !force) throw new ERR_DIR_NONEMPTY('Dir is not empty. To overwrite: --force')
    }

    const parsed = parseLink(link)
    const isFileLink = parsed.protocol === 'file:'
    const localFile = isFileLink && (await fsp.stat(parsed.pathname)).isDirectory() === false
      ? path.basename(parsed.pathname)
      : null
    const key = parsed.drive.key
    checkout = Number(checkout)

    const definition = require('../../../hyperdb/db')
    const db = HyperDB.rocks(PLATFORM_HYPERDB, definition)
    if (hypercoreid.isValid(key)) {
      encryptionKey = await db.get('@pear/bundle', { key: hypercoreid.normalize(key) })?.encryptionKey
      encryptionKey = encryptionKey ? Buffer.from(encryptionKey, 'hex') : null
    }

    const corestore = isFileLink ? null : sidecar._getCorestore(null, null)
    let drive = null

    if (corestore) {
      await corestore.ready()
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      }
    }

    const bundle = new Bundle({
      corestore,
      drive: isFileLink
        ? new LocalDrive(localFile ? path.dirname(parsed.pathname) : parsed.pathname, { followLinks: true })
        : drive,
      key,
      checkout
    })

    await session.add(bundle)

    if (sidecar.swarm && !isFileLink) bundle.join(sidecar.swarm)

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
    if (dir === '-') {
      const pathname = !isFileLink && parsed.pathname === '/' ? '' : prefix
      const entry = pathname === '' ? null : await src.entry(localFile || pathname)
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

    const mirror = src.mirror(dst, { dryRun, prefix })
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
