'use strict'
const hypercoreid = require('hypercore-id-encoding')
const clog = require('pear-changelog')
const semifies = require('semifies')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')
const { ERR_PERMISSION_REQUIRED, ERR_INVALID_INPUT } = require('pear-errors')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Info extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, channel, showKey, metadata, manifest, changelog = null, dir } = {}) {
    if (link && channel) throw ERR_INVALID_INPUT('Must be link or channel cannot be both')

    const { session } = this
    let pod = null
    let drive = null
    let { full = false, max = 10, semver = '^*' } = changelog ?? {}
    if (full) max = Infinity

    const enabledFlags = new Set([full, metadata, showKey].filter((value) => value === true))

    const isEnabled = (flag) => (enabledFlags.size > 0 ? !!flag : !flag)

    const corestore = channel
      ? this.sidecar.getCorestore(State.appname(await State.localPkg({ dir })), channel)
      : this.sidecar.getCorestore(null, null)

    const key = link ? plink.parse(link).drive.key : await Hyperdrive.getDriveKey(corestore)

    const traits = link ? await this.sidecar.model.getTraits(link) : null
    const encryptionKey = traits?.encryptionKey

    if (link || channel) {
      try {
        drive = new Hyperdrive(corestore, key, { encryptionKey })
        await drive.ready()
      } catch (err) {
        if (err.code !== 'DECODING_ERROR') throw err
        throw ERR_PERMISSION_REQUIRED('Encryption key required', {
          key,
          encrypted: true
        })
      }
    } else {
      drive = this.sidecar.drive
    }

    if (link || channel) {
      pod = new Pod({ swarm: this.sidecar.swarm, corestore, key, drive })
      await pod.ready()
    }

    const z32 = drive.key ? hypercoreid.encode(drive.key) : 'dev'
    if (isEnabled(showKey)) {
      const onlyShowKey = enabledFlags.size === 1
      this.push({ tag: 'retrieving', data: { z32, onlyShowKey } })
    }

    await this.sidecar.ready()
    if (pod) {
      await session.add(pod)
      await pod.join()
    }

    if (drive.key && drive.contentKey && drive.discoveryKey) {
      const appManifest = await drive.db.get('manifest').catch((error) => {
        if (error.code === 'DECODING_ERROR') {
          throw ERR_PERMISSION_REQUIRED('Encryption key required', {
            key,
            encrypted: true
          })
        }
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
        if (error.code === 'DECODING_ERROR') {
          throw ERR_PERMISSION_REQUIRED('Encryption key required', {
            key,
            encrypted: true
          })
        }
      })

      if (isEnabled(metadata)) {
        const name = appManifest?.value?.pear?.name || appManifest?.value?.name
        const length = drive.core.length
        const byteLength = drive.core.byteLength
        const blobs = drive.blobs
          ? {
              length: drive.blobs.core.length,
              fork: drive.blobs.core.fork,
              byteLength: drive.blobs.core.byteLength
            }
          : null
        const fork = drive.core.fork
        this.push({
          tag: 'info',
          data: {
            channel: channel?.value,
            release: release?.value || ['Unreleased'],
            name,
            length,
            byteLength,
            blobs,
            fork
          }
        })
      }
    }

    if (!changelog) return

    const contents = await drive.get('/CHANGELOG.md')
    const blank = '[ No Changelog ]'
    const parsed = clog.parse(contents)
    const top = parsed[0]?.[0]
    if (top && semver === '^*') {
      if (full) {
        semver = '*'
      } else {
        let major = top.split(' ')[0].split('.')[0]
        if (major[0] === 'v') major = major.slice(1)
        semver = major.split('.')[0] + '.x.x'
      }
    }

    const entries = parsed
      .filter(([version]) => {
        version = version.split(' ')[0]
        if (version[0] === 'v') version = version.slice(1)
        return semifies(version, semver)
      })
      .slice(0, max)
      .reverse()

    let count = 0
    for (const [version, entry] of entries) {
      this.push({
        tag: 'changelog',
        data: {
          version,
          changelog: entry,
          index: count++,
          max
        }
      })
      if (count === max) break
    }

    if (count === 0) {
      this.push({
        tag: 'changelog',
        data: {
          version: null,
          changelog: blank,
          index: count,
          max
        }
      })
    }
  }
}
