'use strict'
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const sameData = require('same-data')
const hypercoreid = require('hypercore-id-encoding')
const Store = require('./lib/store')
const SharedState = require('../../state')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_MANIFEST } = require('../../errors')
const preferences = new Store('preferences')

module.exports = class State extends SharedState {
  initialized = false
  tier = null
  version = { key: null, length: 0, fork: 0 }
  checkpoint = null

  static preferences = preferences

  constructor (opts) {
    super(opts)
    this.reconfigure()
  }

  reconfigure () {
    this.config = this.constructor.configFrom(this)
  }

  update (state) {
    Object.assign(this, state)
    this.reconfigure()
  }

  async initialize ({ bundle, app, dryRun = false } = {}) {
    if (app?.reported) return
    await bundle.ready()
    if (app?.reported) return
    this.applink = bundle.link

    if (this.key) {
      const result = await bundle.db.get('manifest')
      if (app?.reported) return
      if (result === null) {
        throw ERR_INVALID_MANIFEST(`unable to fetch manifest from app pear://${hypercoreid.encode(this.key)}`)
      }
      if (result.value === null) {
        throw ERR_INVALID_MANIFEST(`empty manifest found from app pear://${hypercoreid.encode(this.key)}`)
      }
      this.constructor.injestPackage(this, result.value)
    } else if (this.stage) {
      const result = await bundle.db.get('manifest')
      if (!result || !sameData(result.value, this.manifest)) {
        if (dryRun === false && this.manifest) {
          await bundle.db.put('manifest', this.manifest)
        }
      }
      if (app?.reported) return
    }

    const tier = !this.key ? 'dev' : bundle.live ? 'production' : 'staging'
    if (app?.reported) return

    if (this.stage && this.manifest === null) throw ERR_INVALID_PROJECT_DIR(`"${this.pkgPath}" not found. Pear project must have a package.json`)

    const { dependencies } = this.manifest
    const options = this.manifest.pear || this.manifest.holepunch || {}
    const name = options.name || this.manifest.name
    const { channel, release } = bundle
    const { main = 'index.html' } = this.manifest

    this.update({ tier, name, main, options, dependencies, channel, release })

    if (this.clearAppStorage) await fsp.rm(this.storage, { recursive: true })
    if (this.clearPreferences) await preferences.clear()

    await fsp.mkdir(this.storage, { recursive: true })
    try { this.checkpoint = JSON.parse(await fsp.readFile(path.join(this.storage, 'checkpoint'))) } catch { /* ignore */ }
    if (app?.reported) return
    if (this.key) {
      this.version = {
        key: hypercoreid.encode(this.key),
        fork: bundle.drive.db.feed.fork,
        length: release || bundle.drive.version
      }
    }
    this.initialized = true
  }
}
