'use strict'
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const { spawn } = require('bare-subprocess')
const sameData = require('same-data')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_MANIFEST, ERR_INVALID_CONFIG, ERR_INVALID_APP_NAME } = require('pear-api/errors')
const { RUNTIME } = require('pear-api/constants')
const SharedState = require('pear-api/state')

module.exports = class State extends SharedState {
  initialized = false
  version = { key: null, length: 0, fork: 0 }
  checkpoint = null
  options = null
  manifest = null
  static async localDef (state) {
    let pkg
    try {
      pkg = await fsp.readFile(path.join(state.dir, 'package.json'))
    } catch {
      const parent = path.dirname(state.dir)
      if (parent === state.dir || path.resolve(state.dir) === path.resolve(parent)) {
        throw ERR_INVALID_PROJECT_DIR('A valid package.json file with pear field must exist in the project')
      }
      state.dir = parent
      return this.localDef(state)
    }
    return JSON.parse(pkg)
  }

  static name (pkg) {
    return pkg?.pear?.name ?? pkg?.name ?? null
  }

  static async build (state, pkg = null) {
    if (pkg === null && state.key === null) pkg = await this.localDef(state)
    state.pkg = pkg
    state.options = pkg?.pear ?? {}
    state.name = this.name(pkg)
    state.main = state.options.main ?? pkg?.main ?? 'index.js'
    if (state.options.via && !state.link?.includes('/node_modules/.bin/')) {
      state.via = Array.isArray(state.options.via) ? state.options.via : [state.options.via]
      for (const name of state.via) {
        const base = state.applink.endsWith('/') ? state.applink : state.applink + '/'
        const link = new URL('node_modules/.bin/' + name, base).toString()
        if (state.link === link) continue
        state.options = await via(state, link)
      }
      state.options.via = null
    }
    const invalidName = /^[@/a-z0-9-_]+$/.test(state.name) === false
    if (invalidName) throw ERR_INVALID_APP_NAME('App name must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')
    state.links = {
      ...Object.fromEntries(Object.entries((state.options.links ?? {}))),
      ...(state.links ?? {})
    }
    state.entrypoints = new Set(state.options.stage?.entrypoints || [])
    state.routes = state.options.routes || null
    state.route = '/' + state.linkData
    const unrouted = new Set(Array.isArray(state.options.unrouted) ? state.options.unrouted : [])
    unrouted.add('/node_modules/.bin/')
    state.unrouted = Array.from(unrouted)
    let entrypoint = this.route(state.route, state.routes, state.unrouted)
    if (entrypoint.startsWith('/') === false) entrypoint = '/' + entrypoint
    else if (entrypoint.startsWith('./')) entrypoint = entrypoint.slice(1)
    state.entrypoint = entrypoint
    return { ...pkg, pear: state.options }
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

  async initialize ({ bundle, app, name, dryRun = false } = {}) {
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
      this.manifest = await this.constructor.build(this, result.value)
      if (app?.reported) return
    } else {
      this.manifest = await this.constructor.build(this)
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
    this.initialized = true
  }
}

async function via (state, link) {
  const options = state.options
  const sp = spawn(RUNTIME, ['run', '--trusted', '--follow-symlinks', link], {
    stdio: ['ignore', 'inherit', 'inherit', 'overlapped'],
    windowsHide: true,
    cwd: state.cwd
  })
  const IDLE_TIMEOUT = 5000
  const pipe = sp.stdio[3]
  const promise = new Promise((resolve, reject) => {
    const onend = () => {
      clearTimeout(timeout)
      pipe.end()
      pipe.destroy()
      reject(new ERR_INVALID_CONFIG('pear.via "' + link + '" ended unexpectedly.'))
    }
    const timeout = setTimeout(() => {
      pipe.end()
      pipe.destroy()
      reject(new ERR_INVALID_CONFIG('pear.via "' + link + '" did not respond with data in time'))
    }, IDLE_TIMEOUT)
    pipe.once('end', onend)
    pipe.once('data', (options) => {
      clearTimeout(timeout)
      pipe.removeListener('end', onend)
      try {
        resolve(JSON.parse(options))
      } catch (err) {
        reject(err)
      } finally {
        pipe.end()
      }
    })
  })
  pipe.write(JSON.stringify(options))
  return promise
}
