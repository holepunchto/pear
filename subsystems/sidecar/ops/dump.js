'use strict'
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const LocalDrive = require('localdrive')
const Bundle = require('../lib/bundle')
const Store = require('../lib/store')
const Opstream = require('../lib/opstream')
const parseLink = require('../../../lib/parse-link')
const Hyperdrive = require('hyperdrive')
const { ERR_PERMISSION_REQUIRED } = require('../../../errors')
const hypercoreid = require('hypercore-id-encoding')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, checkout, encryptionKey }) {
    const { session, sidecar } = this
    await sidecar.ready()
    const parsed = parseLink(link)
    const isFileLink = parsed.protocol === 'file:'
    const localFile = isFileLink && (await fsp.stat(parsed.pathname)).isDirectory() === false
      ? path.basename(parsed.pathname)
      : null
    const key = parsed.drive.key
    checkout = Number(checkout)

    const permits = new Store('permits')
    const secrets = new Store('encryption-keys')
    const encryptionKeys = await permits.get('encryption-keys') || {}
    encryptionKey = (hypercoreid.isValid(key) && encryptionKeys[hypercoreid.normalize(key)]) || await secrets.get(encryptionKey)

    const corestore = isFileLink ? null : sidecar._getCorestore(null, null)
    let drive = null

    if (corestore) {
      await corestore.ready()
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey: encryptionKey ? Buffer.from(encryptionKey, 'hex') : null })
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

    const mirror = src.mirror(dst, { prefix })
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
