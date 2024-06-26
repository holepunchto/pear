'use strict'
const { isBare } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const url = isBare ? require('bare-url') : require('url')
const hypercoreid = require('hypercore-id-encoding')
const { discoveryKey, randomBytes } = require('hypercore-crypto')
const { PLATFORM_DIR, RUNTIME } = require('./constants')
const parseLink = require('./run/parse-link')
const CWD = isBare ? os.cwd() : process.cwd()
const ENV = isBare ? require('bare-env') : process.env
const { ERR_INVALID_APP_NAME, ERR_INVALID_APP_STORAGE } = require('./errors')
const validateAppName = (name) => {
  if (/^[@/a-z0-9-_]+$/.test(name)) return name
  throw ERR_INVALID_APP_NAME('The package.json name / pear.name field must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')
}
const readPkg = (pkgPath) => {
  let pkg = null
  try { pkg = fs.readFileSync(path.resolve(pkgPath)) } catch { /* ignore */ }
  if (pkg) pkg = JSON.parse(pkg) // we want to know if this throws, so no catch
  return pkg
}

module.exports = class State {
  env = null
  channel = null
  args = null
  checkpoint = null
  #onupdate = null
  runtime = RUNTIME
  reloadingSince = 0
  type = null
  error = null
  entrypoints = null
  applink = null
  static injestPackage (state, pkg) {
    state.manifest = pkg
    state.main = pkg?.main || 'index.html'
    state.options = pkg?.pear || pkg?.holepunch || {}
    state.name = pkg?.pear?.name || pkg?.holepunch?.name || pkg?.name || null
    state.type = pkg?.pear?.type || (/\.(c|m)?js$/.test(state.main) ? 'terminal' : 'desktop')
    state.links = pkg?.pear?.links || null
    state.dependencies = [
      ...(pkg?.dependencies ? Object.keys(pkg.dependencies) : []),
      ...(pkg?.devDependencies ? Object.keys(pkg.devDependencies) : []),
      ...(pkg?.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
      ...(pkg?.optionalDependencies ? Object.keys(pkg.optionalDependencies) : []),
      ...(pkg?.bundleDependencies || []),
      ...(pkg?.bundledDependencies || [])
    ]
    state.entrypoints = new Set(pkg?.pear?.stage?.entrypoints || [])
    if (pkg == null) return
    try { this.storage(state) } catch (err) { state.error = err }
  }

  static storage (state) {
    if (!state.key && !state.name) { // uninited local case
      this.injestPackage(state, readPkg(path.join(state.dir, 'package.json')))
      return
    }
    const { previewFor } = state.options
    const previewKey = typeof previewFor === 'string' ? hypercoreid.decode(previewFor) : null
    const dkey = previewKey ? discoveryKey(previewKey).toString('hex') : (state.key ? discoveryKey(state.key).toString('hex') : null)
    const storeby = state.store ? null : (state.key ? ['by-dkey', dkey] : ['by-name', validateAppName(state.name)])
    state.storage = state.store ? (path.isAbsolute(state.store) ? state.store : path.resolve(state.dir, state.store)) : path.join(PLATFORM_DIR, 'app-storage', ...storeby)
    if (state.key === null && state.storage.startsWith(state.dir)) {
      throw ERR_INVALID_APP_STORAGE('Application Storage may not be inside the project directory. --store "' + state.storage + '" is invalid')
    }
  }

  static configFrom (state) {
    const { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, applink, fragment, link, linkData, entrypoint, dir } = state
    const pearDir = PLATFORM_DIR
    return { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, applink, fragment, link, linkData, entrypoint, dir, pearDir }
  }

  update (state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor (params = {}) {
    const { sidecar, link, id = null, args = null, env = ENV, dir = CWD, cmdArgs, onupdate = () => {}, flags, run } = params
    const {
      startId, appling, channel, devtools, checkout,
      dev = false, stage, trace, updates, updatesDiff,
      clearAppStorage, clearPreferences, chromeWebrtcInternals
    } = flags
    if (flags.stage || (run ?? flags.run)) {
      const { NODE_ENV = 'production' } = env
      env.NODE_ENV = NODE_ENV
    }

    const { drive: { alias = null, key = null }, pathname: route, protocol, hash } = link ? parseLink(link) : { drive: {} }
    const pathname = protocol === 'file:' ? route.slice(dir.length) : route
    const fragment = hash ? hash.slice(1) : (isKeetInvite(pathname) ? pathname.slice(1) : null)
    const entrypoint = isEntrypoint(pathname) ? pathname : null
    const pkgPath = path.join(dir, 'package.json')
    const pkg = key === null ? readPkg(pkgPath) : null

    const store = flags.tmpStore ? path.join(os.tmpdir(), randomBytes(16).toString('hex')) : flags.store
    this.#onupdate = onupdate
    this.startId = startId || null
    this.sidecar = sidecar
    this.store = store
    this.args = args
    this.appling = appling
    this.channel = channel || null
    this.checkout = checkout
    this.dir = key === null ? dir : '/'
    this.env = { ...env }
    this.flags = flags
    this.dev = dev
    this.devtools = this.dev || devtools
    this.updatesDiff = this.dev || updatesDiff
    this.updates = updates
    this.run = run ?? flags.run
    this.stage = stage
    this.trace = trace
    this.fragment = fragment
    this.entrypoint = entrypoint
    this.linkData = isKeetInvite(pathname) ? pathname.slice(1) : entrypoint
    this.link = link ? (link.startsWith(protocol) ? link : url.pathToFileURL(link).toString()) : null
    this.key = key
    this.applink = key ? this.link.slice(0, -(~~(pathname?.length) + ~~(hash?.length))) : null
    this.alias = alias
    this.manifest = pkg
    this.cmdArgs = cmdArgs
    this.pkgPath = pkgPath
    this.id = id
    this.clearPreferences = clearPreferences
    this.clearAppStorage = clearAppStorage
    this.chromeWebrtcInternals = chromeWebrtcInternals
    this.constructor.injestPackage(this, pkg)
    this.tbh = 0
  }
}

function isEntrypoint (pathname) {
  if (pathname === null || pathname === '/') return false
  // NOTE: return true once keet invite code detection is no longer needed, assess for removal October 2024
  return isKeetInvite(pathname) === false
}

function isKeetInvite (pathname) {
  return (pathname?.length > 100 || hypercoreid.isValid(pathname?.slice(1)))
}
