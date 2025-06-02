'use strict'
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const sameData = require('same-data')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_MANIFEST, ERR_INVALID_APP_NAME } = require('pear-api/errors')
const SharedState = require('pear-api/state')

module.exports = class State extends SharedState {
  initialized = false
  version = { key: null, length: 0, fork: 0 }
  checkpoint = null
  options = null
  manifest = null

  static async build (state, pkg = null) {
    if (state.manifest) return state.manifest
    if (pkg === null && state.key === null) pkg = await this.localPkg(state)
    if (pkg === null) throw ERR_INVALID_PROJECT_DIR(`"${path.join(this.dir, 'package.json')}" not found. Pear project must have a package.json`)
    state.pkg = pkg
    state.options = state.pkg?.pear ?? {}

    state.name = this.appname(state.pkg)

    state.main = state.options.main ?? pkg?.main ?? 'index.js'

    const invalidName = /^[@/a-z0-9-_]+$/.test(state.name) === false
    if (invalidName) throw ERR_INVALID_APP_NAME('App name must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')

    state.links = {
      ...Object.fromEntries(Object.entries((state.options.links ?? {}))),
      ...(state.links ?? {})
    }
    state.entrypoints = new Set(state.options.stage?.entrypoints || [])
    state.routes = state.options.routes || null
    const unrouted = new Set(Array.isArray(state.options.unrouted) ? state.options.unrouted : [])
    unrouted.add('/node_modules/.bin/')
    state.unrouted = Array.from(unrouted)
    let entrypoint = this.route(state.route, state.routes, state.unrouted)
    if (entrypoint.startsWith('/') === false) entrypoint = '/' + entrypoint
    else if (entrypoint.startsWith('./')) entrypoint = entrypoint.slice(1)
    state.entrypoint = entrypoint
    state.manifest = { ...pkg, pear: state.options }
    return state.manifest
  }

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

  async initialize ({ bundle, app, name, dryRun = false, pkg = null } = {}) {
    if (app?.reported) return
    await bundle.ready()
    if (app?.reported) return
    this.applink = bundle.link

    if (this.key !== null) {
      if (bundle.drive.core.length === 0) {
        await bundle.drive.core.update()
        if (app?.reported) return
      }
      const result = await bundle.db.get('manifest')
      if (app?.reported) return
      if (result === null) {
        throw ERR_INVALID_MANIFEST(`unable to fetch manifest from app pear://${hypercoreid.encode(this.key)}`)
      }
      if (result.value === null) {
        throw ERR_INVALID_MANIFEST(`empty manifest found from app pear://${hypercoreid.encode(this.key)}`)
      }
      await this.constructor.build(this, result.value)
      if (app?.reported) return
    } else {
      await this.constructor.build(this, pkg)
      if (app?.reported) return

      if (this.stage && dryRun === false && this.manifest) {
        const result = await bundle.db.get('manifest')
        if (app?.reported) return
        if (!result || !sameData(result.value, this.manifest)) await bundle.db.put('manifest', this.manifest)
        if (app?.reported) return
      }
    }

    if (app?.reported) return

    if (this.stage && this.manifest === null) throw ERR_INVALID_PROJECT_DIR(`"${path.join(this.dir, 'package.json')}" not found. Pear project must have a package.json`)

    const { dependencies } = this.manifest
    const options = this.options
    name = name ?? options.name
    const { channel, release } = bundle
    const { main = 'index.js' } = this.manifest

    this.update({ name, main, options, dependencies, channel, release })

    if (this.clearAppStorage) await fsp.rm(this.storage, { recursive: true })

    try { this.checkpoint = JSON.parse(await fsp.readFile(path.join(this.storage, 'checkpoint'))) } catch { /* ignore */ }
    if (app?.reported) return
    if (this.key) {
      this.version = {
        key: hypercoreid.encode(this.key),
        fork: bundle.drive.db.feed.fork,
        length: release || bundle.drive.version
      }
    }
  }
}
