'use strict'
const { isBare, isWindows } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const url = isBare ? require('bare-url') : require('url')
const hypercoreid = require('hypercore-id-encoding')
const { discoveryKey, randomBytes } = require('hypercore-crypto')
const z32 = require('z32')
const { PLATFORM_DIR, RUNTIME } = require('./constants')
const parseLink = require('./lib/parse-link')
const CWD = isBare ? os.cwd() : process.cwd()
const ENV = isBare ? require('bare-env') : process.env
const { ERR_INVALID_APP_NAME, ERR_INVALID_APP_STORAGE, ERR_INVALID_CONFIG } = require('./errors')
const validateAppName = (name) => {
  if (/^[@/a-z0-9-_]+$/.test(name)) return name
  throw new ERR_INVALID_APP_NAME('The package.json name / pear.name field must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')
}
const validateString = (str) => {
  if (/^[@/a-zA-Z0-9-_.]+$/.test(str)) return str
  throw new ERR_INVALID_CONFIG('Invalid string in config. The string may only contain letters (a-z, A-Z), numbers (0-9), hyphens (-), underscores (_), forward slashes (/), asperands (@), and periods (.).')
}
const validatePattern = (pattern) => {
  if (/^[a-zA-Z0-9-_*?!.@/[\]{}()+^$\\|]+$/.test(pattern)) return pattern
  throw new ERR_INVALID_CONFIG(`Invalid pattern "${pattern}". Pattern contains invalid characters.`)
}
const validateTransforms = (transforms) => {
  if (!transforms) return null
  if (typeof transforms !== 'object') throw new ERR_INVALID_CONFIG('Transforms should be an object.')
  for (const pattern in transforms) {
    validatePattern(pattern)
    const transformArray = transforms[pattern]
    if (!Array.isArray(transformArray)) throw new ERR_INVALID_CONFIG(`Transforms for "${pattern}" should be an array.`)
    for (const transform of transformArray) {
      if (typeof transform === 'string') {
        validateString(transform)
        continue
      }
      if (typeof transform === 'object' && transform !== null) {
        if (!transform.name || typeof transform.name !== 'string') throw new ERR_INVALID_CONFIG(`Each transform in "${pattern}" should have a "name" field of type string.`)
        validateString(transform.name)

        if ('options' in transform && (typeof transform.options !== 'object' || transform.options === null)) {
          throw new ERR_INVALID_CONFIG(`The "options" field in "${pattern}" should be an object.`)
        }
        continue
      }
      throw new ERR_INVALID_CONFIG(`Invalid transform format in "${pattern}". Each transform should be either a string or an object.`)
    }
  }
  return transforms
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
  dht = null
  static injestPackage (state, pkg, overrides = {}) {
    state.manifest = pkg
    state.main = pkg?.main || 'index.html'
    state.options = pkg?.pear || pkg?.holepunch || {}
    state.name = pkg?.pear?.name || pkg?.holepunch?.name || pkg?.name || null
    state.type = pkg?.pear?.type || (/\.(c|m)?js$/.test(state.main) ? 'terminal' : 'desktop')
    state.links = pkg?.pear?.links || null
    if (overrides.links) {
      const links = overrides.links.split(',').reduce((links, kv) => {
        const [key, value] = kv.split('=')
        links[key] = value
        return links
      }, {})
      state.links = { ...(state.links || {}), ...links }
    }
    state.dependencies = [
      ...(pkg?.dependencies ? Object.keys(pkg.dependencies) : []),
      ...(pkg?.devDependencies ? Object.keys(pkg.devDependencies) : []),
      ...(pkg?.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
      ...(pkg?.optionalDependencies ? Object.keys(pkg.optionalDependencies) : []),
      ...(pkg?.bundleDependencies || []),
      ...(pkg?.bundledDependencies || [])
    ]
    state.entrypoints = new Set(pkg?.pear?.stage?.entrypoints || [])
    state.transforms = validateTransforms(pkg?.pear?.transforms) || null
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
    state.storage = state.store ? (path.isAbsolute(state.store) ? state.store : path.resolve(state.cwd, state.store)) : path.join(PLATFORM_DIR, 'app-storage', ...storeby)
    if (state.key === null && state.storage.startsWith(state.dir)) {
      throw new ERR_INVALID_APP_STORAGE('Application Storage may not be inside the project directory. --store "' + state.storage + '" is invalid')
    }
  }

  static configFrom (state) {
    const { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, applink, fragment, link, linkData, entrypoint, dir, dht, transforms } = state
    const pearDir = PLATFORM_DIR
    return { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, applink, fragment, link, linkData, entrypoint, dir, dht, transforms, pearDir }
  }

  static isKeetInvite (segment) {
    if (!segment || segment.length < 100) return false
    try { z32.decode(segment) } catch { return false }
    return true
  }

  static isEntrypoint (pathname) {
    if (pathname === null || pathname === '/') return false
    // NOTE: return true once keet invite code detection is no longer needed, assess for removal October 2024
    const segment = pathname = pathname?.startsWith('/') ? pathname.slice(1) : pathname
    return this.isKeetInvite(segment) === false
  }

  update (state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor (params = {}) {
    const { dht, link, id = null, args = null, env = ENV, dir = CWD, cwd = dir, cmdArgs, onupdate = () => {}, flags, run } = params
    const {
      startId, appling, channel, devtools, checkout, links,
      dev = false, stage, trace, updates, updatesDiff,
      unsafeClearAppStorage, unsafeClearPreferences, chromeWebrtcInternals
    } = flags
    const { drive: { alias = null, key = null }, pathname: route, protocol, hash } = link ? parseLink(link) : { drive: {} }
    const pathname = protocol === 'file:' ? isWindows ? route.slice(1).slice(dir.length) : route.slice(dir.length) : route
    const segment = pathname?.startsWith('/') ? pathname.slice(1) : pathname
    const fragment = hash ? hash.slice(1) : (this.constructor.isKeetInvite(segment) ? segment : null)
    const entrypoint = this.constructor.isEntrypoint(pathname) ? pathname : null
    const pkgPath = path.join(dir, 'package.json')
    const pkg = key === null ? readPkg(pkgPath) : null
    const store = flags.tmpStore ? path.join(os.tmpdir(), randomBytes(16).toString('hex')) : flags.store
    this.#onupdate = onupdate
    this.startId = startId || null
    this.dht = dht
    this.store = store
    this.args = args
    this.appling = appling
    this.channel = channel || null
    this.checkout = checkout
    this.dir = dir
    this.cwd = cwd
    this.run = run ?? flags.run
    this.flags = flags
    this.dev = dev
    this.devtools = this.dev || devtools
    this.updatesDiff = this.dev || updatesDiff
    this.updates = updates
    this.stage = stage
    this.trace = trace
    this.fragment = fragment
    this.entrypoint = entrypoint
    this.linkData = segment
    this.link = link ? (link.startsWith(protocol) ? link : url.pathToFileURL(link).toString()) : null
    this.key = key
    this.applink = key ? this.link.slice(0, -(~~(pathname?.length) + ~~(hash?.length))) : null
    this.alias = alias
    this.manifest = pkg
    this.cmdArgs = cmdArgs
    this.pkgPath = pkgPath
    this.id = id
    this.clearPreferences = unsafeClearPreferences
    this.clearAppStorage = unsafeClearAppStorage
    this.chromeWebrtcInternals = chromeWebrtcInternals
    this.env = { ...env }
    if (this.stage || (this.run && this.dev === false)) {
      this.env.NODE_ENV = this.env.NODE_ENV || 'production'
    }
    this.constructor.injestPackage(this, pkg, { links })
  }
}
