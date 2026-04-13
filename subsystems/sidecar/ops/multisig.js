'use strict'
const { ERR_INVALID_LINK, ERR_INVALID_INPUT } = require('pear-errors')
const plink = require('pear-link')
const HyperMultisig = require('hyper-multisig')
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const z32 = require('z32')
const Opstream = require('../lib/opstream')

module.exports = class Multisig extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    await this.sidecar.ready()
    if (
      !params.publicKeys ||
      Array.isArray(params.publicKeys) === false ||
      params.publicKeys.length === 0
    ) {
      throw ERR_INVALID_INPUT('publicKeys array required')
    }
    if (!params.quorum) throw ERR_INVALID_INPUT('quorum required')
    if (!params.namespace) throw ERR_INVALID_INPUT('namespace required')
    this.config = {
      publicKeys: params.publicKeys,
      quorum: params.quorum,
      namespace: params.namespace
    }
    if (params.action === 'link') return this.link()
    if (params.action === 'request') return this.request(params)
    if (params.action === 'verify') return this.verify(params)
    if (params.action === 'commit') return this.commit(params)
  }

  async link() {
    const { publicKeys, namespace, quorum } = this.config
    for (const publicKey of publicKeys) {
      if (hypercoreid.isValid(publicKey) === false) {
        throw ERR_INVALID_INPUT('Invalid publicKeys signing key: ' + publicKey)
      }
    }
    const key = HyperMultisig.getCoreKey(publicKeys, namespace, { quorum })
    this.final = { link: plink.serialize({ drive: { key } }) }
  }
  async request(params) {
    const { publicKeys, namespace, quorum } = this.config
    const multisig = new HyperMultisig(this.sidecar.corestore, this.sidecar.swarm)
    const { verlink, force, peerUpdateTimeout } = params
    const parsed = plink.parse(verlink)
    if (parsed === null || parsed.drive.key === null || parsed.drive.length === null) {
      throw ERR_INVALID_LINK('A valid versioned source link must be specified', { verlink })
    }
    const { key, length } = parsed.drive
    const srcDrive = new Hyperdrive(this.sidecar.getCorestore(), key)
    try {
      const req = multisig.requestDrive(publicKeys, namespace, srcDrive, length, {
        force,
        peerUpdateTimeout,
        quorum
      })

      req.on('getting-src-blobs', () => this.push({ tag: 'getting-src-blobs' }))
      req.on('verify-db-requestable-start', () => this.push({ tag: 'verify-db-requestable-start' }))
      req.on('getting-blobs-length', () => this.push({ tag: 'getting-blobs-length' }))
      req.on('verify-blobs-requestable-start', () =>
        this.push({ tag: 'verify-blobs-requestable-start' })
      )
      req.on('creating-drive', () => this.push({ tag: 'creating-drive' }))

      const res = await req.done()
      this.final = { request: z32.encode(res.request) }
    } finally {
      await srcDrive.close()
    }
  }
  async verify(params) {
    return this.commit({ ...params, dryRun: true })
  }
  async commit(params) {
    const { link, dryRun, request, responses = [], forceDangerous, peerUpdateTimeout } = params
    if (!link) throw new Error('missing link')
    if (!request) throw new Error('missing request')

    this.push({ tag: 'multisigging', data: { request, responses, dryRun } })

    const { publicKeys, namespace, quorum } = this.config
    const multisig = new HyperMultisig(this.sidecar.corestore, this.sidecar.swarm)

    const parsed = plink.parse(link)
    if (parsed === null || parsed.drive.key === null) {
      throw ERR_INVALID_LINK('A valid source link must be specified', { link })
    }
    const corestore = this.sidecar.getCorestore()
    const srcDrive = new Hyperdrive(corestore, parsed.drive.key)
    const key = HyperMultisig.getCoreKey(publicKeys, namespace, { quorum })
    const entry = await this.sidecar.db.model.getMultisig(key)
    let firstCommit = entry === null
    if (firstCommit) {
      const multisigCore = corestore.get(key)
      await multisigCore.ready()
      this.sidecar.swarm.join(multisigCore.discoveryKey, { client: true, server: false })
      await multisigCore.update()
      firstCommit = multisigCore.length === 0
      await multisigCore.close()
    }
    try {
      const commit = multisig.commitDrive(publicKeys, namespace, srcDrive, request, responses, {
        skipTargetChecks: firstCommit,
        force: forceDangerous,
        dryRun,
        peerUpdateTimeout,
        quorum
      })

      let srcKey, dstKey
      commit.on('verify-committable-start', (sk, dk) => {
        srcKey = sk
        dstKey = dk
        this.push({ tag: 'verify-committable-start', data: { srcKey, dstKey } })
      })
      commit.on('commit-start', () => {
        this.push({ tag: 'commit-start', data: { dryRun, srcKey, dstKey } })
      })
      commit.on('verify-committed-start', (key) => {
        const link = plink.serialize({ drive: { key } })
        this.push({ tag: 'verify-committed-start', data: { firstCommit, key, link } })
      })

      const res = await commit.done()

      if (!dryRun) await this.sidecar.db.model.setMultisig(key)

      this.final = {
        dstKey: res.result.db.destCore.key,
        dryRun,
        quorum: { amount: res.manifest.quorum, total: res.quorum },
        result: res.result
      }
    } finally {
      await srcDrive.close()
    }
  }
}
