'use strict'
const hypercoreid = require('hypercore-id-encoding')
const clog = require('pear-changelog')
const deriveEncryptionKey = require('pw-to-ek')
const parseLink = require('../../../lib/parse-link')
const Hyperdrive = require('hyperdrive')
const Bundle = require('../lib/bundle')
const State = require('../state')
const Opstream = require('../lib/opstream')
const { ERR_PERMISSION_REQUIRED } = require('../../../errors')
const { SALT } = require('../../../constants')

module.exports = class Info extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, channel, dir, showKey, metadata, changelog, full, encryptionKey, cmdArgs } = {}) {
    const { session } = this
    let bundle = null
    let drive = null
    const enabledFlags = new Set([changelog, full, metadata, showKey].filter((value) => value === true))
    const isEnabled = (flag) => enabledFlags.size > 0 ? !!flag : !flag

    const state = new State({ flags: { channel, link }, dir, cmdArgs })
    const corestore = link ? this.sidecar._getCorestore(null, null) : this.sidecar._getCorestore(state.name, channel)

    const key = link ? parseLink(link).drive.key : await Hyperdrive.getDriveKey(corestore)

    if (encryptionKey) {
      encryptionKey = await deriveEncryptionKey(encryptionKey, SALT)
    } else {
      const query = await this.sidecar.db.get('@pear/bundle', { link: hypercoreid.normalize(key) })
      encryptionKey = query?.encryptionKey ? Buffer.from(query.encryptionKey, 'hex') : null
    }

    if (link || channel) {
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      }
    } else {
      drive = this.sidecar.drive
    }

    if (link || channel) {
      bundle = new Bundle({ corestore, key, drive })
      await bundle.ready()
    }

    const z32 = hypercoreid.encode(key)
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
      const [channel, release, manifest] = await Promise.all([
        drive.db.get('channel'),
        drive.db.get('release'),
        drive.db.get('manifest')
      ]).catch((error) => {
        if (error.code === 'DECODING_ERROR') throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
      })

      const name = manifest?.value?.pear?.name || manifest?.value?.holepunch?.name || manifest?.value?.name
      const length = drive.core.length
      const byteLength = drive.core.byteLength
      const blobs = drive.blobs ? { length: drive.blobs.core.length, fork: drive.blobs.core.fork, byteLength: drive.blobs.core.byteLength } : null
      const fork = drive.core.fork
      if (isEnabled(metadata)) this.push({ tag: 'info', data: { channel: channel?.value, release: release?.value || ['Unreleased'], name, length, byteLength, blobs, fork } })
    }

    const contents = await drive.get('/CHANGELOG.md')

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
