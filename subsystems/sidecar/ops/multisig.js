'use strict'
const path = require('bare-path')
const { ERR_INVALID_LINK, ERR_INVALID_INPUT, ERR_INVALID_CONFIG } = require('pear-errors')
const plink = require('pear-link')
const HyperMultisig = require('hyper-multisig')
const Localdrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const z32 = require('z32')
const Opstream = require('../lib/opstream')

module.exports = class Multisig extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    await this.sidecar.ready()
    if (!params.package) throw ERR_INVALID_INPUT('package param required')
    const drive = new Localdrive(path.dirname(params.package))
    const { pear = {} } = JSON.parse(await drive.get('/package.json'))
    const multisig = pear.multisig
    if (!multisig) throw ERR_INVALID_CONFIG('package.json pear.multisig field required')
    if (!multisig.signers) {
      throw ERR_INVALID_CONFIG('package.json pear.multisig.signers field required')
    }
    if (!multisig.quorum) {
      throw ERR_INVALID_CONFIG('package.json pear.multisig.quorum field required')
    }
    if (!multisig.namespace) {
      throw ERR_INVALID_CONFIG('package.json pear.multisig.namespace field required')
    }
    this.config = multisig
    if (params.action === 'link') return this.link()
    if (params.action === 'request') return this.request(params)
    if (params.action === 'verify') return this.verify(params)
    if (params.action === 'commit') return this.commit(params)
  }

  async link() {
    const { signers, namespace } = this.config
    const key = HyperMultisig.getCoreKey(signers, namespace) // TODO: needed in hyper-multisg
    this.final = { link: plink.serialize({ drive: { key } }) }
  }
  async request(params) {
    const { signers, namespace, quorum } = this.config
    const multisig = new HyperMultisig(this.sidecar.corestore, this.sidecar.swarm)
    const { verlink, force, peerUpdateTimeout } = params
    const parsed = plink.parse(verlink)
    if (parsed === null || parsed.drive.key === null || parsed.drive.length === null) {
      throw ERR_INVALID_LINK('A valid versioned source link must be specified', { verlink })
    }
    const { key, length } = parsed.drive
    const srcDrive = new Hyperdrive(this.sidecar.getCorestore(), key)
    try {
      const req = multisig.requestDrive(signers, namespace, srcDrive, length, {
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
    const {
      link,
      dryRun,
      request,
      responses = [],
      firstCommit,
      forceDangerous,
      peerUpdateTimeout
    } = params
    if (!link) throw new Error('missing link')
    if (!request) throw new Error('missing request')

    this.push({ tag: 'multisigging', data: { request, responses, dryRun } })

    const { signers, namespace, quorum } = this.config
    const multisig = new HyperMultisig(this.sidecar.corestore, this.sidecar.swarm)

    const parsed = plink.parse(link)
    if (parsed === null || parsed.drive.key === null) {
      throw ERR_INVALID_LINK('A valid source link must be specified', { link })
    }
    const srcDrive = new Hyperdrive(this.sidecar.getCorestore(), parsed.drive.key)
    try {
      const commit = multisig.commitDrive(signers, namespace, srcDrive, request, responses, {
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
        this.push({ tag: 'verify-committed-start', data: { firstCommit, key } })
      })

      const res = await commit.done()

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
