'use strict'
const { ERR_INVALID_LINK, ERR_INVALID_INPUT } = require('pear-errors')
const plink = require('pear-link')
const HyperMultisig = require('hyper-multisig')
const Hyperdrive = require('hyperdrive')
const Opstream = require('../lib/opstream')

module.exports = class Multisig extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    await this.sidecar.ready()

    // TODO: get multisig config (package.json -> multisig)
    //this.config = ...
    if (params.actions === 'link') return this.link()
    if (params.actions === 'request') return this.request(params)
    if (params.actions === 'verify') return this.verify(params)
    if (params.actions === 'commit') return this.commit(params)
  }

  async link() {
    const { publicKeys, namespace } = this.config
    const key = HyperMultisig.getCoreKey(publicKeys, namespace) // TODO: needed in hyper-multisg
    this.final = { link: plink.serialize({ drive: { key } }) }
  }
  async request(params) {
    const { publicKeys, namespace, quorum } = this.config
    const multisig = new Multisig(this.sidecar.corestore, this.sidecar.swarm)
    const { link, force, peerUpdateTimeout } = params
    const parsed = plink.parse(link)
    if (parsed === null || parsed.drive.key === null || parsed.drive.length === null) {
      throw ERR_INVALID_LINK('A valid versioned source link must be specified', { link })
    }
    const { key, length } = parsed.drive
    const srcDrive = new Hyperdrive(this.sidecar.corestore, key)
    const req = await multisig.requestDrive(publicKeys, namespace, srcDrive, length, {
      force,
      peerUpdateTimeout,
      quorum
    })

    req.on('getting-src-blobs', () => {
      this.push({ tag: 'getting-src-blobs' })
      // console.log('Getting the source blobs...')
    })
    req.on('verify-db-requestable-start', () => {
      this.push({ tag: 'verify-db-requestable-start' })
      // console.log('Verifying the db core is requestable....')
    })
    req.on('getting-blobs-length', () => {
      this.push({ tag: 'getting-blobs-length' })
      // console.log('Getting the blobs length (this can take a while)...')
    })
    req.on('verify-blobs-requestable-start', () => {
      this.push({ tag: 'verify-blobs-requestable-start' })
      // console.log('Verifying the blobs core is requestable...')
    })
    req.on('creating-drive', () => {
      this.push({ tag: 'creating-drive' })
      // console.log('Creating the drive...')
    })

    const res = await req.done()
    this.final = res.request
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

    this.push({ tag: 'comitting', data: { request, responses } })
    // console.info(`Committing request ${request}`)
    // console.info(`Responses:\n -${responses.join('\n -')}`)

    const { publicKeys, namespace, quorum } = this.config
    const multisig = new Multisig(this.sidecar.corestore, this.sidecar.swarm)

    const srcDrive = new Hyperdrive(store, idEnc.decode(srcKey))
    const commit = multisig.commitDrive(publicKeys, namespace, srcDrive, request, responses, {
      skipTargetChecks: firstCommit,
      force: forceDangerous,
      peerUpdateTimeout: peerUpdateTimeout,
      quorum
    })

    commit.on('verify-committable-start', (srcKey, dstKey) => {
      this.push({ tag: 'creating-drive', data: { srcKey, dstKey } })
      // console.log(
      // `Verifying safe to commit (source ${idEnc.normalize(srcKey)} to multisig target ${idEnc.normalize(tgtKey)})`
      // )
    })
    commit.on('commit-start', () => {
      this.push({ tag: 'commit-start', data: { dryRun, srcKey, dstKey } })
      // console.log(`Committing...`)
    })
    commit.on('verify-committed-start', (key) => {
      // console.log(`Committed (key ${idEnc.normalize(key)})`)
      // console.log('Waiting for remote seeders to pick up the changes...')
      this.push({ tag: 'verify-commited-start', data: { firstCommit, key } })
      // if (firstCommit) {
      //   console.log(
      //     'Please add this key to the seeders now. The logs here will notify you when it is picked up by them. Do not shut down until that happens.'
      //   )
      // }
    })

    const res = await commit.done()

    const dstKey = res.result.db.destCore.key

    this.final = {
      dstKey,
      dryRun,
      quorum: { amount: manifest.quorum, total: quorum },
      result: res.result
    }

    // if (dryRun) {
    //   console.log(`\nQuorum: ${quorum} / ${manifest.quorum}`)
    //   console.log('\nReview batch to commit:', JSON.stringify(result, null, 2))
    // } else {
    //   console.log('\nCommitted:', JSON.stringify(result, null, 2))
    //   console.log('\n~ DONE ~ Seeding now ~ Press Ctrl+C to exit ~\n')
    // }
    // console.info(`${type} key: ${dstKey}`)
  }
}
