'use strict'
const hypercoreid = require('hypercore-id-encoding')
const clog = require('pear-changelog')
const plink = require('pear-api/link')
const Hyperdrive = require('hyperdrive')
const { ERR_PERMISSION_REQUIRED } = require('pear-api/errors')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Info extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, channel, dir, showKey, metadata, changelog, manifest, full, cmdArgs } = {}) {
    const { session } = this
    let bundle = null
    let drive = null
    const enabledFlags = new Set([changelog, full, metadata, showKey].filter((value) => value === true))
    const isEnabled = (flag) => enabledFlags.size > 0 ? !!flag : !flag

    const state = new State({ flags: { channel, link }, dir, cmdArgs })
    const corestore = link ? this.sidecar._getCorestore(null, null) : this.sidecar._getCorestore(state.name, channel)

    const key = link ? plink.parse(link).drive.key : await Hyperdrive.getDriveKey(corestore)

    const query = link ? await this.sidecar.model.getBundle(link) : null
    const encryptionKey = query?.encryptionKey

    if (link || channel) {
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      }
    } else {
      drive = this.sidecar.drive
    }

    if (link || channel) {
      bundle = new Bundle({ corestore, key, drive })
      await bundle.ready()
    }

    const z32 = drive.key ? hypercoreid.encode(drive.key) : 'dev'
    if (isEnabled(showKey)) {
      const onlyShowKey = enabledFlags.size === 1
      this.push({ tag: 'retrieving', data: { z32, onlyShowKey } })
    }

    await this.sidecar.ready()
    if (bundle) {
      await session.add(bundle)
      await bundle.join(this.sidecar.swarm)
    }

    if (drive.key && drive.contentKey && drive.discoveryKey) {
      const appManifest = await drive.db.get('manifest').catch((error) => {
        if (error.code === 'DECODING_ERROR') throw ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      })

      if (manifest) {
        this.push({ tag: 'manifest', data: { manifest: appManifest.value } })
        this.final = { manifest: appManifest.value }
        return
      }

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
      const [channel, release] = await Promise.all([
        drive.db.get('channel'),
        drive.db.get('release')
      ]).catch((error) => {
        if (error.code === 'DECODING_ERROR') throw ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      })

      if (isEnabled(metadata)) {
        const name = appManifest?.value?.pear?.name || appManifest?.value?.name
        const length = drive.core.length
        const byteLength = drive.core.byteLength
        const blobs = drive.blobs ? { length: drive.blobs.core.length, fork: drive.blobs.core.fork, byteLength: drive.blobs.core.byteLength } : null
        const fork = drive.core.fork
        this.push({ tag: 'info', data: { channel: channel?.value, release: release?.value || ['Unreleased'], name, length, byteLength, blobs, fork } })
      }
    }

    const type = full ? 'full' : 'latest'
    const showChangelog = isEnabled(changelog) || full ? type : false

    if (showChangelog) {
      const contents = await drive.get('/CHANGELOG.md')
      const blank = '[ No Changelog ]'
      const parsed = showChangelog === 'latest'
        ? (clog.parse(contents).at(0)?.[1]) || blank
        : showChangelog === 'full'
          ? (clog.parse(contents).map(entry => entry[1]).join('\n\n')) || blank
          : blank

      this.push({ tag: 'changelog', data: { changelog: parsed, full } })
    }
  }
}
