'use strict'
const plink = require('pear-link')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_LINK, ERR_INVALID_MANIFEST } = require('pear-errors')
const Hyperdrive = require('hyperdrive')
const Opstream = require('../lib/opstream')

module.exports = class Provision extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({
    sourceLink,
    targetLink,
    productionLink,
    dryRun,
    cooldown = 10_000,
    cooloff = 15_000
  }) {
    const source = plink.parse(sourceLink)
    if (source.drive.length === null) {
      throw ERR_INVALID_LINK('sourceLink must be versioned', {
        link: sourceLink
      })
    }

    const target = plink.parse(targetLink) // validates

    const production = plink.parse(productionLink)
    if (production.drive.length === null) {
      throw ERR_INVALID_LINK('targetLink must be versioned', {
        link: productionLink
      })
    }

    const { sidecar } = this
    await sidecar.ready()

    const bootstrap =
      production.drive.fork === 0 && production.drive.length === 0

    const to = new Hyperdrive(
      sidecar.getCorestore('!provision', '#targets', { writable: true }),
      target.drive.key,
      { compat: false }
    )
    await to.ready()

    const prod = new Hyperdrive(sidecar.getCorestore(), production.drive.key)
    await prod.ready()

    const from = new Hyperdrive(sidecar.getCorestore(), source.drive.key)
    await from.ready()

    // hydrate prod
    if (prod.core.length === 0 && !bootstrap && production.drive.length !== 0) {
      await new Promise((resolve) => prod.core.once('append', () => resolve()))
    }

    prod.core.download()

    this.push({ tag: 'syncing', data: { type: 'metadata' } })
    while (to.core.length < prod.core.length) {
      await to.core.append(await prod.core.get(to.core.length))
      this.push({
        tag: 'blocks',
        data: {
          type: 'metadata',
          targetLength: to.core.length,
          productionLength: prod.core.length
        }
      })
    }
    this.push({ tag: 'synced', data: { type: 'metadata' } })

    await to.getBlobs()
    if (prod.core.length > 0) {
      await prod.getBlobs()
      prod.blobs.core.download()

      this.push({ tag: 'syncing', data: { type: 'blobs' } })
      while (to.blobs.core.length < prod.blobs.core.length) {
        await to.blobs.core.append(
          await prod.blobs.core.get(to.blobs.core.length)
        )
        this.push({
          tag: 'blocks',
          data: {
            type: 'blobs',
            targetLength: to.core.length,
            productionLength: prod.core.length
          }
        })
      }
      this.push({ tag: 'synced', data: { type: 'blobs' } })
    }

    const co = from.checkout(source.drive.length || from.core.length)
    await co.ready()

    let changes = 0

    this.push({ tag: 'diffing' })
    for await (const diff of co.mirror(to, { dryRun: true, batch: true })) {
      changes++
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
    const pkg = JSON.parse(await co.get('/package.json'))
    if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
      throw new ERR_INVALID_MANIFEST('Source has non-production SemVer', {
        version: pkg.version
      })
    }

    this.push({
      tag: 'diffed',
      data: {
        changes,
        semver: pkg.version,
        core: {
          id: to.core.id,
          length: to.core.length,
          hash: hypercoreid.encode(await to.core.treeHash())
        },
        blobs: {
          id: to.blobs.core.id,
          length: to.blobs.core.length,
          hash: hypercoreid.encode(await to.blobs.core.treeHash())
        }
      }
    })

    if (dryRun) {
      this.push({ tag: 'dry' })
      return
    }

    this.push({ tag: 'cooldown', data: { time: cooldown } })
    await new Promise((resolve) => setTimeout(resolve, cooldown))
    this.push({ tag: 'staging' })

    for await (const data of co.mirror(to, { batch: true })) {
      changes++
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
      tag: 'staged',
      data: { changes }
    })

    if (await to.db.get('release')) {
      this.push({ tag: 'unsetting', data: { field: 'release' } })
      await to.db.del('release')
    }

    const fields = [
      'manifest',
      'metadata',
      'channel',
      'platformVersion',
      'warmup'
    ]

    for (const field of fields) {
      const src = await co.db.get(field)
      const dst = await to.db.get(field)

      if (!src && !dst) {
        continue
      }

      if (!src && dst) {
        this.push({ tag: 'unsetting', data: { field } })
        await dst.db.del(field)
        continue
      }

      if (
        (src && !dst) ||
        JSON.stringify(src.value) !== JSON.stringify(dst.value)
      ) {
        this.push({ tag: 'setting', data: { field, value: src.value } })
        await to.db.put(field, src.value)
      }
    }

    this.push({
      tag: 'provisioned',
      data: {
        target: plink.serialize({
          protocol: 'pear',
          drive: {
            key: to.core.id,
            fork: to.core.fork,
            length: to.core.length
          }
        })
      }
    })

    this.push({
      tag: 'seeding',
      data: { cooloff, peers: to.core.peers.length }
    })

    const deferred = Promise.withResolvers()
    const teardown = () => {
      this.push({ tag: 'inactive' })
      to.close().finally(() => {
        deferred.resolve()
      })
    }

    let timeout = setTimeout(teardown, cooloff)
    const blobs = await to.getBlobs()

    to.core.on('upload', function () {
      clearTimeout(timeout)
      timeout = setTimeout(teardown, cooloff)
    })

    blobs.core.on('upload', function () {
      clearTimeout(timeout)
      timeout = setTimeout(teardown, cooloff)
    })

    await deferred.promise
  }
}
