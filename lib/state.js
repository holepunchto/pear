'use strict'
const { isWindows, isBare } = require('which-runtime')
const os = require('bare-os')
const fsp = require('bare-fs/promises')
const path = require('bare-path')
const crypto = require('hypercore-crypto')
const CWD = isBare ? os.cwd() : process.cwd()
const ENV = require('bare-env')
const plink = require('pear-link')
const {
  ERR_INVALID_PROJECT_DIR,
  ERR_INVALID_APP_STORAGE,
  ERR_INVALID_APP_NAME
} = require('pear-errors')

module.exports = class State {
  env = null
  channel = null
  args = null
  checkpoint = null
  #onupdate = null
  reloadingSince = 0
  type = null
  entrypoints = null
  entrypoint = null
  applink = null
  dht = null
  route = null
  routes = null
  unrouted = null
  assets = {}
  version = { key: null, length: 0, fork: 0 }
  options = null
  manifest = null
  static async localPkg(state) {
    let pkg
    try {
      pkg = JSON.parse(await fsp.readFile(path.join(state.dir, 'package.json')))
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EISDIR' && err.code !== 'ENOTDIR') throw err
      const parent = path.dirname(state.dir)
      if (parent === state.dir || path.resolve(state.dir) === path.resolve(parent)) return null
      state.dir = parent
      return this.localPkg(state)
    }
    return pkg
  }

  static appname(pkg) {
    return pkg?.pear?.name ?? pkg?.name ?? null
  }

  static async build(state, pkg = null) {
    if (state.manifest) return state.manifest
    const originDir = state.dir
    if (pkg === null && state.key === null) pkg = await this.localPkg(state)
    if (pkg === null) {
      throw ERR_INVALID_PROJECT_DIR(
        `"package.json not found from: ${originDir}. Pear project must have a package.json`
      )
    }
    state.pkg = pkg
    state.options = state.pkg?.pear ?? {}

    state.name = state.name ?? this.appname(state.pkg)

    state.main = state.options.main ?? pkg?.main ?? 'index.js'

    const invalidName = /^[@/a-z0-9-_]+$/.test(state.name) === false
    if (invalidName) {
      throw ERR_INVALID_APP_NAME(
        'App name must be lowercase and one word, and may contain letters, numbers, hyphens (-), underscores (_), forward slashes (/) and asperands (@).'
      )
    }

    state.links = {
      ...Object.fromEntries(Object.entries(state.options.links ?? {})),
      ...(state.links ?? {})
    }
    state.entrypoints = Array.isArray(state.options.stage?.entrypoints)
      ? state.options.stage?.entrypoints
      : []
    state.routes = state.options.routes || null
    const unrouted = Array.isArray(state.options.unrouted) ? state.options.unrouted : []
    state.unrouted = Array.from(new Set([...unrouted, ...state.entrypoints]))
    const { entrypoint, routed } = this.route(state)
    state.entrypoint = entrypoint
    state.entry = state.entrypoint === '/' ? '/' + state.main : state.entrypoint
    state.routed = routed
    state.manifest = { ...pkg, pear: state.options }
    return state.manifest
  }

  static route(state) {
    let result = null
    if (state.prerunning || !state.routes) {
      result = { entrypoint: state.route, routed: false }
    } else if (state.unrouted.some((unroute) => state.route.startsWith(unroute))) {
      result = { entrypoint: state.route, routed: false }
    } else {
      let route =
        typeof state.routes === 'string' ? state.routes : (state.routes[state.route] ?? state.route)
      if (route[0] === '.') route = route.length === 1 ? '/' : route.slice(1)
      result = { entrypoint: route, routed: true }
    }
    if (result.entrypoint.startsWith('/') === false) result.entrypoint = '/' + result.entrypoint
    else if (result.entrypoint.startsWith('./')) result.entrypoint = result.entrypoint.slice(1)
    return result
  }

  static configFrom(state) {
    const {
      id,
      startId,
      key,
      links,
      alias,
      env,
      gui,
      assets,
      options,
      checkpoint,
      checkout,
      flags,
      dev,
      stage,
      storage,
      name,
      main,
      args,
      channel,
      release,
      applink,
      query,
      fragment,
      link,
      linkData,
      entrypoint,
      route,
      routes,
      dir,
      dht,
      prerunning,
      version
    } = state
    return {
      id,
      startId,
      key,
      links,
      alias,
      env,
      gui,
      assets,
      options,
      checkpoint,
      checkout,
      flags,
      dev,
      stage,
      storage,
      name,
      main,
      args,
      channel,
      release,
      applink,
      query,
      fragment,
      link,
      linkData,
      entrypoint,
      route,
      routes,
      dir,
      dht,
      prerunning,
      length: version?.length,
      fork: version?.fork
    }
  }

  update(state) {
    Object.assign(this, state)
    this.#onupdate()
  }

  constructor(params = {}) {
    const {
      dht,
      link = '.',
      startId = null,
      id = null,
      args = null,
      env = ENV,
      cwd = CWD,
      dir = cwd,
      cmdArgs,
      onupdate = () => {},
      flags = {},
      run,
      storage = null,
      pid
    } = params
    const {
      appling,
      channel,
      devtools,
      checkout,
      stage,
      updates,
      updatesDiff,
      links = '',
      prerunning = false,
      dev = false,
      parent = null,
      followSymlinks,
      unsafeClearAppStorage,
      chromeWebrtcInternals
    } = flags
    const parsedLink = plink.parse(link)
    const {
      drive: { alias = null, key = null } = {},
      pathname: route = '',
      protocol,
      origin,
      hash,
      search
    } = parsedLink
    let pathname = protocol === 'file:' && isWindows ? route.slice(1) : route
    // for on disk route support, this relies on passed in dir being the actual project dir:
    if (protocol === 'file:') pathname = pathname.slice(dir.length)
    const store = flags.tmpStore
      ? path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex'))
      : flags.store
    this.#onupdate = onupdate
    this.startId = startId
    this.dht = dht
    this.store = store
    this.args = args
    this.appling = appling
    this.channel = channel || null
    this.checkout = checkout
    this.cwd = cwd
    this.dir = dir
    this.run = run
    this.storage = storage
    this.flags = flags
    this.dev = dev
    this.devtools = this.dev || devtools
    this.updatesDiff = this.dev || updatesDiff
    this.updates = updates
    this.stage = stage
    this.fragment = hash ? hash.slice(1) : ''
    this.query = search ? search.slice(1) : ''
    this.route = pathname
    this.linkData = this.route?.startsWith('/') ? this.route.slice(1) : this.route
    this.key = key
    this.link = link
      ? link.startsWith(protocol)
        ? link
        : plink.normalize(plink.serialize(parsedLink))
      : null
    this.applink = key ? origin : plink.normalize(plink.serialize(plink.parse(this.dir)))
    this.alias = alias
    this.cmdArgs = cmdArgs
    this.id = id
    this.followSymlinks = followSymlinks
    this.rti = flags.rti ? JSON.parse(flags.rti) : null // important to know if this throws, so no try/catch
    this.prerunning = prerunning
    this.parent = parent
    this.pid = pid
    this.clearAppStorage = unsafeClearAppStorage
    this.chromeWebrtcInternals = chromeWebrtcInternals
    this.env = { ...env }
    if (this.stage || (this.run && this.dev === false)) {
      this.env.NODE_ENV = this.env.NODE_ENV || 'production'
    }
    this.links = links.split(',').reduce((links, kv) => {
      const [key, value] = kv.split('=')
      links[key] = value
      return links
    }, {})
    this.storage = this.store
      ? path.isAbsolute(this.store)
        ? this.store
        : path.resolve(this.cwd, this.store)
      : this.storage
    const invalidStorage =
      this.key === null &&
      this.storage !== null &&
      this.storage.startsWith(this.dir) &&
      this.storage.includes(path.sep + 'pear' + path.sep + 'pear' + path.sep) === false
    if (invalidStorage) {
      throw ERR_INVALID_APP_STORAGE(
        'Application Storage may not be inside the project directory. --store "' +
          this.storage +
          '" is invalid'
      )
    }
  }
}
