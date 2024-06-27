'use strict'
const hypercoreid = require('hypercore-id-encoding')
const clog = require('pear-changelog')
const parseLink = require('../../../run/parse-link')
const Bundle = require('../lib/bundle')
const State = require('../state')
const Opstream = require('../lib/opstream')

module.exports = class Info extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, channel, dir, showKey, metadata, changelog, full, cmdArgs } = {}) {
    const { session } = this
    let bundle = null
    const anyFlag = [changelog, full, metadata, showKey].some(flag => flag === true)
    const isEnabled = (flag) => anyFlag ? !!flag : !flag
    if (link) {
      const parsed = parseLink(link)
      const key = parsed.drive.key
      const hex = key.toString('hex')
      const z32 = hypercoreid.encode(key)
      const corestore = this.sidecar._getCorestore(null, null)
      bundle = new Bundle({ corestore, key })
      await bundle.ready()
      if (isEnabled(showKey)) this.push({ tag: 'retrieving', data: { hex, z32 } })
    } else if (channel) {
      const state = new State({ flags: { channel, link }, dir, cmdArgs })
      const corestore = this.sidecar._getCorestore(state.name, channel)
      bundle = new Bundle({ corestore, channel })
      await bundle.ready()
      const hex = bundle.drive.key.toString('hex')
      const z32 = hypercoreid.encode(bundle.drive.key)
      if (isEnabled(showKey)) this.push({ tag: 'retrieving', data: { hex, z32 } })
    } else if (this.sidecar.drive.key) {
      const hex = this.sidecar.drive.key.toString('hex')
      const z32 = hypercoreid.encode(this.sidecar.drive.key)
      if (isEnabled(showKey)) this.push({ tag: 'retrieving', data: { hex, z32 } })
    }
    await this.sidecar.ready()
    if (bundle) {
      await session.add(bundle)
      await bundle.join(this.sidecar.swarm)
    }
    const drive = bundle?.drive || this.sidecar.drive

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

      const channel = (await drive.db.get('channel'))?.value
      const release = (await drive.db.get('release'))?.value || '[ Unreleased ]'
      const manifest = (await drive.db.get('manifest'))?.value
      const name = manifest?.pear?.name || manifest?.holepunch?.name || manifest.name
      const length = drive.core.length
      const byteLength = drive.core.byteLength
      const blobs = drive.blobs ? { length: drive.blobs.core.length, fork: drive.blobs.core.fork, byteLength: drive.blobs.core.byteLength } : null
      const fork = drive.core.fork
      if (isEnabled(metadata)) this.push({ tag: 'info', data: { channel, release, name, length, byteLength, blobs, fork } })
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
