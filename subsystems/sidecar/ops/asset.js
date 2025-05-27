'use strict'
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const plink = require('pear-api/link')
const { ERR_PERMISSION_REQUIRED } = require('pear-api/errors')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const DriveMonitor = require('../lib/drive-monitor')

module.exports = class Asset extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dryRun, only, prune = !only, force = false }) {
    const { session, sidecar } = this
    const { model } = sidecar
    await sidecar.ready()
    const unlock = model.lock.manual()
    session.teardown(unlock)
    const parsed = plink.parse(link)
    // TODO
    // if (parsed.drive.length === null) {
    //   parsed.drive.length = getLatestDriveLength()
    //   link = plink.serialize(parsed)
    // }

    const asset = await model.touchAsset(link)
    asset.forced = force
    this.final = asset
    if (asset.forced === false && asset.inserted === false) return
    const isFileLink = parsed.protocol === 'file:'
    const isFile = isFileLink && (await fsp.stat(parsed.pathname)).isDirectory() === false

    const key = parsed.drive.key
    const checkout = parsed.drive.length

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

    const dir = asset.path

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
        this.push({ tag: 'byteDiff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'change') {
        this.push({ tag: 'byteDiff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'remove') {
        this.push({ tag: 'byteDiff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } })
      }
    }
    let totalBytes = 0
    for await (const entry of dst.list('/')) {
      if (entry.value.blob) totalBytes += entry.value.blob.byteLength
    }
    await model.updateAssetBytesAllocated(link, totalBytes)
    const assets = await model.allAssets()
    const maxCapacity = 12 * 1024 ** 3
    const currentUsage = assets.reduce((sum, { bytesAllocated = 0 }) => sum + bytesAllocated, 0)
    if (currentUsage > maxCapacity) await model.gcFirstAsset()
  }
}
