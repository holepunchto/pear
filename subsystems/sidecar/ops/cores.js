'use strict'
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')

module.exports = class Cores extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    LOG.info('cores', 'Enumerating cores')

    const allCores = params.allCores

    const { sidecar, session } = this

    const corestore = this.sidecar.getCorestore().session({ writable: false })
    await corestore.ready()
    session.add(corestore)

    const discoveryKeys = []
    for await (const dkey of corestore.list()) discoveryKeys.push(dkey)

    let writableCount = 0
    let count = 0

    LOG.info('cores', `Found ${discoveryKeys.length} discovery keys`)

    const contentLinks = new Map() // content link -> metadata link
    const cores = new Map() // link -> core

    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await corestore.storage.getInfo(discoveryKey)

      const key = info.auth.key
      const link = plink.serialize({ drive: { key } })

      const core = corestore.get({
        discoveryKey: info.discoveryKey,
        active: false
      })
      await core.ready()
      const coreInfo = await core.info()
      if (!allCores && coreInfo.contiguousLength === 0) {
        LOG.trace('cores', `Skipping empty core ${link}`)
        continue
      }

      ++count

      const writable = Boolean(info.auth.keyPair)
      if (writable) {
        ++writableCount
      }

      const contentLink = getContentLink(info)
      if (contentLink !== null) contentLinks.set(contentLink, link)
      cores.set(link, { key, writable, length: core.length })

      core.close()
    }

    const names = new Map() // metadata link -> name, content link -> name
    for (const [link, { key }] of cores) {
      if (contentLinks.has(link)) continue
      const name = await getName(corestore, key)
      if (name !== null) names.set(link, name)
    }

    for (const [contentLink, link] of contentLinks) {
      if (names.has(link)) names.set(contentLink, names.get(link))
    }

    for (const [link, { writable, length }] of cores) {
      this.push({
        tag: 'core',
        data: {
          link,
          writable,
          length,
          blobs: contentLinks.has(link),
          name: names.get(link) ?? null
        }
      })
    }

    this.final = { count, writable: writableCount }
  }
}

function getContentLink(info) {
  const manifest = info.auth.manifest
  if (!manifest) return null
  const contentKey = Hyperdrive.getContentKey(manifest, info.auth.key)
  if (!contentKey) return null
  return plink.serialize({ drive: { key: contentKey } })
}

async function getName(corestore, key) {
  const drive = new Hyperdrive(corestore, key, { active: false })
  await drive.ready()
  const buffer = await drive.get('/package.json', { wait: false })
  if (buffer === null) return null
  const pkg = JSON.parse(buffer)
  return pkg?.productName || pkg?.name || null
}
