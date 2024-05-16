'use strict'
const { isBare } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const hypercoreid = require('hypercore-id-encoding')
const unixPathResolve = require('unix-path-resolve')
const { discoveryKey, randomBytes } = require('hypercore-crypto')
const parseLink = require('../run/parse-link')
const { PLATFORM_DIR, RUNTIME, ALIASES } = require('../lib/constants')
const CWD = isBare ? os.cwd() : process.cwd()
const ENV = isBare ? require('bare-env') : process.env
const { ERR_INVALID_APP_NAME, ERR_INVALID_APP_STORAGE } = require('../lib/errors')
const validateAppName = (name) => {
  if (/^[@/a-z0-9-_]+$/.test(name)) return name
  throw ERR_INVALID_APP_NAME('The package.json name / pear.name field must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')
}
const readPkg = (pkgPath) => {
  let pkg = null
  try { pkg = fs.readFileSync(unixPathResolve(pkgPath)) } catch { /* ignore */ }
  if (pkg) pkg = JSON.parse(pkg) // we want to know if this throws, so no catch
  return pkg
}

module.exports = class Context {
  env = null
  channel = null
  args = null
  checkpoint = null
  #onupdate = null
  runtime = RUNTIME
  reloadingSince = 0
  type = null
  error = null
  static injestPackage (ctx, pkg) {
    ctx.manifest = pkg
    ctx.main = pkg?.main || 'index.html'
    ctx.options = pkg?.pear || pkg?.holepunch || {}
    ctx.name = pkg?.pear?.name || pkg?.holepunch?.name || pkg?.name || null
    ctx.type = pkg?.pear?.type || (/\.(c|m)?js$/.test(ctx.main) ? 'terminal' : 'desktop')
    ctx.links = pkg?.pear?.links || null
    ctx.dependencies = [
      ...(pkg?.dependencies ? Object.keys(pkg.dependencies) : []),
      ...(pkg?.devDependencies ? Object.keys(pkg.devDependencies) : []),
      ...(pkg?.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
      ...(pkg?.optionalDependencies ? Object.keys(pkg.optionalDependencies) : []),
      ...(pkg?.bundleDependencies || []),
      ...(pkg?.bundledDependencies || [])
    ]
    if (pkg == null) return
    try { this.storage(ctx) } catch (err) { ctx.error = err }
  }

  static storage (ctx) {
    if (!ctx.key && !ctx.name) { // uninited local case
      this.injestPackage(ctx, readPkg(path.join(ctx.dir, 'package.json')))
      return
    }
    const { previewFor } = ctx.options
    const previewKey = typeof previewFor === 'string' ? hypercoreid.decode(previewFor) : null
    const dkey = previewKey ? discoveryKey(previewKey).toString('hex') : (ctx.key ? discoveryKey(Buffer.from(ctx.key.hex, 'hex')).toString('hex') : null)
    const storeby = ctx.store ? null : (ctx.key ? ['by-dkey', dkey] : ['by-name', validateAppName(ctx.name)])
    ctx.storage = ctx.store ? (path.isAbsolute(ctx.store) ? ctx.store : path.resolve(ctx.cwd, ctx.store)) : path.join(PLATFORM_DIR, 'app-storage', ...storeby)

    if (ctx.key === null && ctx.storage.startsWith(ctx.dir)) {
      throw ERR_INVALID_APP_STORAGE('Application Storage may not be inside the project directory. --store "' + ctx.storage + '" is invalid')
    }
  }

  static configFrom (ctx) {
    const { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, dir } = ctx
    const pearDir = PLATFORM_DIR
    return { id, key, links, alias, env, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, dir, pearDir }
  }

  update (state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor (params = {}) {
    const { sidecar, link, id = null, args = null, env = ENV, dir = CWD, clientArgv, onupdate = () => {}, flags } = params
    const {
      startId, appling, channel, devtools, checkout,
      dev, run, stage, trace, updates, updatesDiff,
      clearAppStorage, clearPreferences, chromeWebrtcInternals
    } = flags

    if (flags.stage || flags.run) {
      const { NODE_ENV = 'production' } = env
      env.NODE_ENV = NODE_ENV
    }

    const { data: linkData = null, alias = null, key = null } = link ? parseLink(link) : {}
    const pkgPath = path.join(dir, 'package.json')
    const pkg = key === null ? readPkg(pkgPath) : null

    const store = flags['tmp-store'] ? path.join(os.tmpdir(), randomBytes(16).toString('hex')) : flags.store
    this.#onupdate = onupdate
    this.startId = startId || null
    this.sidecar = sidecar
    this.store = store
    this.args = args
    this.appling = appling
    this.channel = channel || null
    this.checkout = checkout
    this.dir = dir
    this.env = { ...env }
    this.flags = flags
    this.dev = dev || false
    this.devtools = devtools
    this.updates = updates
    this.updatesDiff = updatesDiff
    this.run = run
    this.stage = stage
    this.trace = trace
    this.link = link
    this.linkData = linkData
    this.key = key
    this.alias = alias
    this.dir = dir
    this.manifest = pkg
    this.clientArgv = clientArgv
    this.pkgPath = pkgPath
    this.id = id
    this.clearPreferences = clearPreferences
    this.clearAppStorage = clearAppStorage
    this.chromeWebrtcInternals = chromeWebrtcInternals
    this.constructor.injestPackage(this, pkg)
    if (ALIASES.keet.z32 === this.key?.z32) this.tbh = 0
    else this.tbh = this.options.platform?.__legacyTitlebar ? 48 : 0
  }
}
