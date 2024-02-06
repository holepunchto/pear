'use strict'
const { PLATFORM_DIR, RUNTIME, IS_BARE } = require('../lib/constants')
const os = IS_BARE ? require('bare-os') : require('os')
const path = IS_BARE ? require('bare-path') : require('path')
const { discoveryKey } = require('hypercore-crypto')
const { decode } = require('hypercore-id-encoding')

const parse = require('../lib/parse')
const CWD = IS_BARE ? os.cwd() : process.cwd()
const ENV = IS_BARE ? require('bare-env') : process.env
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
  distributions = null
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
    const storeby = ctx.store ? null : (ctx.key ? ['by-dkey', discoveryKey(Buffer.from(ctx.key.hex, 'hex')).toString('hex')] : ['by-name', validateAppName(ctx.name)])
    ctx.storage = ctx.store ? (path.isAbsolute(ctx.store) ? ctx.store : path.resolve(ctx.cwd, ctx.store)) : path.join(PLATFORM_DIR, 'app-storage', ...storeby)
    if (ctx.storage.startsWith(ctx.dir)) {
      ctx.error = new Error('Application Storage may not be inside the project directory. --store "' + ctx.store + '" is invalid')
      ctx.error.code = 'ERR_INVALID_APPLICATION_STORAGE'
    }
  }

  static configFrom (ctx) {
    const { id, key, alias, env, cwd, options, checkpoint, flags, dev, tier, tools, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, distributions, dir } = ctx
    const pearDir = PLATFORM_DIR
    return { id, key, alias, env, cwd, options, checkpoint, flags, dev, tier, tools, stage, storage, trace, name, main, dependencies, args, channel, release, link, linkData, distributions, dir, pearDir }
  }

  update (state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor ({ sidecar, id = null, argv = [], env = ENV, cwd = CWD, clientArgv, distributions, onupdate = () => {} } = {}) {
    const {
      startId, store, appling, flags, channel, checkout,
      dev, run, stage, trace, key, alias, tools,
      local, dir, appArgs, pkg, pkgPath,
      clearAppStorage, clearPreferences,
      chromeWebrtcInternals
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
    this.dev = dev
    this.run = run
    this.stage = stage
    this.trace = trace
    this.distributions = distributions?.[key?.z32] || null
    this.link = this.flags.run || this.flags.link || 'pear:dev'
    if (this.link && !this.link.startsWith('pear:') && !this.link.startsWith('punch:')) this.link = 'pear://' + this.link
    this.linkData = parse.run(this.link).data
    this.key = (this.distributions?.current)
      ? { z32: this.distributions[this.distributions.current], hex: decode(this.distributions[this.distributions.current]).toString('hex') }
      : key
    this.alias = alias
    this.tools = tools
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
  }
}
