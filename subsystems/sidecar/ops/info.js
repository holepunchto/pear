'use strict'
const hypercoreid = require('hypercore-id-encoding')
const clog = require('pear-changelog')
const parseLink = require('../../../lib/parse-link')
const Hyperdrive = require('hyperdrive')
const Bundle = require('../lib/bundle')
const Store = require('../lib/store')
const State = require('../state')
const Opstream = require('../lib/opstream')
const { ERR_PERMISSION_REQUIRED } = require('../../../errors')

module.exports = class Info extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, channel, dir, showKey, metadata, changelog, full, encryptionKey, cmdArgs } = {}) {
    console.log('info')
    const { session } = this
    let bundle = null
    let drive = null
    const enabledFlags = new Set([changelog, full, metadata, showKey].filter((value) => value === true))
    const isEnabled = (flag) => enabledFlags.size > 0 ? !!flag : !flag

    const state = new State({ flags: { channel, link }, dir, cmdArgs })
    const corestore = link ? this.sidecar._getCorestore(null, null) : this.sidecar._getCorestore(state.name, channel)

    console.log('pre getDriveKey')
    const key = link ? parseLink(link).drive.key : await Hyperdrive.getDriveKey(corestore)
    console.log('aft getDriveKey')
    const permits = new Store('permits')
    const secrets = new Store('encryption-keys')
    console.log('pre encryption-keys')
    const encryptionKeys = await permits.get('encryption-keys') || {}
    console.log('aft encryption-keys')
    console.log('pre secrets.get')
    encryptionKey = encryptionKeys[hypercoreid.normalize(key)] || await secrets.get(encryptionKey)
    console.log('aft secrets.get')

    if (link || channel) {
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey: encryptionKey ? Buffer.from(encryptionKey, 'hex') : null })
        console.log('pre drive.ready')
        await drive.ready()
        console.log('aft drive.ready')
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      }
    } else {
      drive = this.sidecar.drive
    }

    if (link || channel) {
      bundle = new Bundle({ corestore, key, drive })
      console.log('pre bundle.ready')
      await bundle.ready()
      console.log('aft bundle.ready')
    }

    const z32 = hypercoreid.encode(key)
    if (isEnabled(showKey)) {
      const onlyShowKey = enabledFlags.size === 1
      this.push({ tag: 'retrieving', data: { z32, onlyShowKey } })
    }
    console.log('pre sidecar ready')
    await this.sidecar.ready()
    console.log('aft sidecar ready')
    if (bundle) {
      console.log('pre sess add')
      await session.add(bundle)
      console.log('aft sess add')
      console.log('pre bun join')
      await bundle.join(this.sidecar.swarm)
      console.log('aft bun join')
    }

    if (drive.key && drive.contentKey && drive.discoveryKey) {
      if (isEnabled(metadata)) {
        this.push({
          tag: 'keys',
          data: {
            project: drive.key.toString('hex'),
            content: drive.contentKey.toString('hex'),
            discovery: drive.discoveryKey.toString('hex')
          }
        })
      }
      console.log('pre Promise.all db.gets')
      const [channel, release, manifest] = await Promise.all([
        drive.db.get('channel'),
        drive.db.get('release'),
        drive.db.get('manifest')
      ]).catch((error) => {
        console.error('catch', error)
        if (error.code === 'DECODING_ERROR') throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      })

      const name = manifest?.value?.pear?.name || manifest?.value?.holepunch?.name || manifest?.value?.name
      const length = drive.core.length
      const byteLength = drive.core.byteLength
      const blobs = drive.blobs ? { length: drive.blobs.core.length, fork: drive.blobs.core.fork, byteLength: drive.blobs.core.byteLength } : null
      const fork = drive.core.fork
      if (isEnabled(metadata)) this.push({ tag: 'info', data: { channel: channel?.value, release: release?.value || ['Unreleased'], name, length, byteLength, blobs, fork } })
    }
    console.log('pre drive get')
    const contents = await drive.get('/CHANGELOG.md')
    console.log('aft drive get')

    const type = full ? 'full' : 'latest'
    const showChangelog = isEnabled(changelog) || full ? type : false
    const blank = '[ No Changelog ]'
    const parsed = showChangelog === 'latest'
      ? (clog.parse(contents).at(0)?.[1]) || blank
      : showChangelog === 'full'
        ? (clog.parse(contents).map(entry => entry[1]).join('\n\n')) || blank
        : blank

    if (showChangelog) this.push({ tag: 'changelog', data: { changelog: parsed, full } })
  }
}
