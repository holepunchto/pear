'use strict'
const { PLATFORM_DIR, RUNTIME, ALIASES } = require('../lib/constants')
const { isBare } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
const path = isBare ? require('bare-path') : require('path')
const hypercoreid = require('hypercore-id-encoding')
const { discoveryKey } = require('hypercore-crypto')

const parse = require('../lib/parse')
const CWD = isBare ? os.cwd() : process.cwd()
const ENV = isBare ? require('bare-env') : process.env
const validateAppName = (name) => {
  if (/^[@/a-z0-9-_]+$/.test(name)) return name
  throw new Error('The package.json name / pear.name field must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).')
}

module.exports = class Context {
  env = null
  cwd = null
  channel = null
  argv = null
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
      this.injestPackage(ctx, require(path.join(ctx.dir, 'package.json')))
      return
    }
    const { previewFor } = ctx.options    
    const previewKey = typeof previewFor === 'string' ? hypercoreid.decode(previewFor) : null
    const dkey = previewKey ? discoveryKey(previewKey).toString('hex') : (ctx.key ? discoveryKey(Buffer.from(ctx.key.hex, 'hex')).toString('hex') : null)
    const storeby = ctx.store ? null : (ctx.key ? ['by-dkey', dkey] : ['by-name', validateAppName(ctx.name)])
    ctx.storage = ctx.store ? (path.isAbsolute(ctx.store) ? ctx.store : path.resolve(ctx.cwd, ctx.store)) : path.join(PLATFORM_DIR, 'app-storage', ...storeby)

    if (ctx.key === null && ctx.storage.startsWith(ctx.dir)) {
      const err = new Error('Application Storage may not be inside the project directory. --store "' + ctx.storage + '" is invalid')
      err.code = 'ERR_INVALID_APPLICATION_STORAGE'
      throw err
    }
  }

  static configFrom (ctx) {
    const { id, key, alias, env, cwd, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, dir } = ctx
    const pearDir = PLATFORM_DIR
    return { id, key, alias, env, cwd, options, checkpoint, flags, dev, tier, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, dir, pearDir }
  }

  update (state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor ({ sidecar, id = null, argv = [], env = ENV, cwd = CWD, clientArgv, onupdate = () => {} } = {}) {
    const {
      startId, store, appling, flags, channel, devtools,
      checkout, run, stage, trace, key, link, updates,
      alias, local, dir, appArgs, pkg, pkgPath, updatesDiff,
      clearAppStorage, clearPreferences, chromeWebrtcInternals
    } = parse.argv(argv, env, cwd)

    this.#onupdate = onupdate
    this.startId = startId || null
    this.sidecar = sidecar
    this.store = store
    this.argv = argv
    this.appling = appling
    this.channel = channel || null
    this.checkout = checkout
    this.cwd = cwd
    this.env = { ...env }
    this.flags = flags
    this.dev = key === null
    this.devtools = devtools
    this.updates = updates
    this.updatesDiff = updatesDiff
    this.run = run
    this.stage = stage
    this.trace = trace
    this.link = link
    if (this.link && !this.link.startsWith('pear:')) this.link = 'pear://' + this.link
    this.linkData = parse.runkey(this.link).data
    this.key = key
    this.alias = alias
    this.local = local
    this.dir = dir
    this.manifest = pkg
    this.args = appArgs
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
