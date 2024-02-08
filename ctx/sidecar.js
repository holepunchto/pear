'use strict'
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const sameData = require('same-data')
const preferences = require('../lib/preferences')
const SharedContext = require('./shared')

module.exports = class Context extends SharedContext {
  initialized = false
  tier = null
  version = { key: null, length: 0, fork: 0 }
  checkpoint = null
  onreconfig = null // extern set
  constructor (opts) {
    super(opts)
    this.reconfigure()
  }

  reconfigure () {
    this.config = this.constructor.configFrom(this)
    if (this.onreconfig && this.initialized && !this.stage) {
      this.onreconfig()
    }
  }

  update (state) {
    Object.assign(this, state)
    this.reconfigure()
  }

  async initialize ({ bundle, app, dryRun = false } = {}) {
    if (app?.reported) return
    await bundle.ready()
    if (app?.reported) return

    if (this.key) {
      const result = await bundle.db.get('manifest')
      if (app?.reported) return
      if (result === null) {
        const err = new Error(`unable to fetch manifest from app ${this.key?.z32}`)
        err.code = 'ERR_CONNECTION'
        throw err
      }

      this.constructor.injestPackage(this, result.value)
    } else if (this.stage) {
      const result = await bundle.db.get('manifest')

      if (!result || !sameData(result.value, this.manifest)) {
        if (dryRun === false) await bundle.db.put('manifest', this.manifest)
      }
      if (app?.reported) return
    }

    const tier = !this.key ? 'dev' : bundle.live ? 'production' : 'staging'
    if (app?.reported) return

    if (this.stage && this.manifest === null) throw new Error(`"${this.pkgPath}" not found. Pear project must have a package.json`)

    const { dependencies, type = 'commonjs' } = this.manifest
    const options = this.manifest.pear || this.manifest.holepunch || {}
    const name = options.name || this.manifest.name
    const { channel, release } = bundle
    const { main = 'index.html' } = this.manifest

    this.update({ tier, name, main, options, dependencies, type, channel, release })

    if (this.clearAppStorage) await fsp.rm(this.storage, { recursive: true })
    if (this.clearPreferences) await preferences.clear()

    await fsp.mkdir(this.storage, { recursive: true })
    try { this.checkpoint = JSON.parse(await fsp.readFile(path.join(this.storage, 'checkpoint'))) } catch { /* ignore */ }
    if (app?.reported) return
    if (this.key) {
      this.version = {
        key: this.key?.z32,
        fork: bundle.drive.db.feed.fork,
        length: release || bundle.drive.version
      }
    }
    this.initialized = true
  }
}
