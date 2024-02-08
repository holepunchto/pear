'use strict'
const constants = require('./constants')
const path = constants.IS_BARE ? require('bare-path') : require('path')
const fs = constants.IS_BARE ? require('bare-fs') : require('fs')
const os = constants.IS_BARE ? require('bare-os') : require('os')
const { fileURLToPath, pathToFileURL } = require('url-file-url')
const { randomBytes } = require('hypercore-crypto')
const hypercoreid = require('hypercore-id-encoding')
const unixPathResolve = require('unix-path-resolve')

const runkey = (link) => {
  if (!link) throw new Error('No link specified')
  if (link.startsWith('pear://') === false) link = 'pear://' + link
  let parsed = null
  try {
    parsed = new URL(decodeURI(link))
  } catch {
    return { key: null, data: null }
  }
  let slash = parsed.pathname.indexOf('/')
  let alias = null
  let k = parsed.host ? parsed.host : parsed.pathname.slice(0, slash > -1 ? slash : parsed.pathname.length)
  if (!parsed.host) {
    // new URL returns non-writables, recreate the object:
    parsed = { ...parsed, pathname: parsed.pathname.slice(k.length) }
    slash = parsed.pathname.indexOf('/')
  }

  if (k === 'runtime' || k === 'keet') {
    alias = k
    k = constants.ALIASES[alias].z32
  } else {
    for (const [name, { z32, hex }] of Object.entries(constants.ALIASES)) {
      if (k !== z32 && k !== hex) continue
      alias = name
    }
  }

  const data = parsed.pathname.slice(slash > -1 ? slash + 1 : 0) || null

  try {
    const buffer = hypercoreid.decode(k)
    const key = { hex: buffer.toString('hex'), z32: hypercoreid.encode(buffer), buffer }
    return { key, data, alias }
  } catch {
    try {
      const buffer = hypercoreid.decode(link)
      const key = { hex: buffer.toString('hex'), z32: hypercoreid.encode(buffer), buffer }
      return { key, data, alias }
    } catch {
      return { key: null, data, alias }
    }
  }
}

const appling = (appfile) => {
  if (constants.IS_WINDOWS) {
    const name = appfile.slice(appfile.lastIndexOf('\\') + 1).replace(/\.exe$/i, '')
    return { path: appfile, name, icon: path.join(appfile, '../resources/app/icon.png') }
  }

  if (constants.IS_MAC) {
    const end = appfile.indexOf('.app')
    const name = end === -1 ? null : appfile.slice(appfile.lastIndexOf('/', end) + 1, end)
    return { path: appfile, name, icon: null }
  }

  // linux
  return { path: appfile, name: null, icon: null }
}

const argv = (argv, env, cwd) => {
  const { _: [value], run } = args(argv, { boolean: ['run'], default: { run: false } })
  let key = run ? value : null
  const boundix = argv.indexOf(value)
  const appArgs = run ? argv.slice(boundix + 1) : []
  argv = argv.slice(0, boundix)
  const { _, ...flags } = args(argv, {
    boolean: ['run', 'stage', 'dev', 'tmp-store', 'unsafe-clear-app-storage', 'unsafe-clear-preferences', '--chrome-webrtc-internals'],
    string: ['link', 'channel', 'appling', 'checkout', 'store', 'trace', 'start-id'],
    alias: { store: 's', 'tmp-store': 't' },
    default: {
      appling: false, // appling may be a string or a false boolean
      run: false,
      dev: false,
      stage: false,
      'tmp-store': false,
      'unsafe-clear-app-storage': false,
      'unsafe-clear-preferences': false,
      checkout: 'release'
    }
  })
  flags.launch = flags.run
  let alias = null
  if (key !== null) {
    const parsed = runkey(key)
    if (parsed.key === null) {
      key = null
    } else {
      key = parsed.key
      if (parsed.alias) alias = parsed.alias
    }
  } else if (flags.link) {
    const parsed = runkey(flags.link)
    if (parsed.alias) alias = parsed.alias
  }

  const isUrl = value && (value.startsWith('pear:') || value.startsWith('file:'))
  const url = value && (isUrl ? value : pathToFileURL(value).toString())

  const link = flags.link || (key ? url : 'pear://dev')

  const dir = key == null ? (isUrl ? fileURLToPath(value) : value || cwd) : cwd

  const local = key === null && !flags.stage

  if (flags.stage || flags.run) {
    const { NODE_ENV = 'production' } = env
    env.NODE_ENV = NODE_ENV
  }

  const pkgPath = path.join(dir, 'package.json')

  let pkg = null
  if (key === null) {
    try { pkg = fs.readFileSync(unixPathResolve(pkgPath)) } catch { /* ignore */ }
    if (pkg) pkg = JSON.parse(pkg) // we want to know if this throws, that's why no catch for parse
  }

  const store = flags['tmp-store'] ? path.join(os.tmpdir(), randomBytes(16).toString('hex')) : flags.store

  return {
    store,
    link,
    startId: flags['start-id'],
    clearAppStorage: flags['unsafe-clear-app-storage'],
    clearPreferences: flags['unsafe-clear-preferences'],
    chromeWebrtcInternals: flags['chrome-webrtc-internals'],
    appling: flags.appling && appling(flags.appling),
    channel: flags.channel,
    checkout: flags.checkout,
    dev: flags.dev,
    run: flags.run,
    stage: flags.stage,
    trace: flags.trace,
    flags,
    key,
    alias,
    local,
    dir,
    appArgs,
    pkg,
    pkgPath
  }
}

const arg = (flag, argv = Bare.argv) => {
  for (let index = argv.length - 1; index >= 0; index--) {
    const item = argv[index]
    let value = (item === flag) ? argv[index + 1] : null
    if (value?.[0] === '-' && isNaN(value)) value = ''
    if (item.startsWith(flag + '=')) value = item.split('=')[1].trim()
    if (value === null) continue
    if (value === undefined) value = ''
    const end = value.length - 1
    if ((value[0] === '"' || value[0] === '\'') && (value[end] === '"' || value[end] === '\'')) value = value.slice(1, -1)
    return value
  }
  return false
}

function args (argv, opts = {}) {
  const { boolean = [], string = [], alias = {}, default: def = {}, validate = false } = opts
  const valid = validate ? [...boolean, ...string, ...Object.values(alias).flat(), ...constants.PLATFORM_FLAGS.map((str) => str.slice(2))] : null
  const parsed = { _: [], ...def }

  for (let i = 0; i < argv.length; i++) {
    const val = argv[i]
    const split = val.split('=')
    const flag = split[0]

    if (val[0] !== '-') {
      parsed._.push(val)
      continue
    }

    let name = flag[1] === '-' ? flag.slice(2) : flag.slice(1)
    const isNo = name.startsWith('no-')
    if (isNo) name = name.slice(3)

    if (validate && !valid.includes(name)) {
      const err = new Error(`Invalid flag: ${flag}`)
      err.code = 'ERR_INVALID_FLAG'
      throw err
    }

    for (const [actual, aliases] of Object.entries(alias)) {
      if (typeof aliases === 'string' ? aliases === name : aliases.includes(name)) {
        name = actual
        break
      }
    }

    if (boolean.includes(name)) {
      parsed[name] = !isNo
    } else if (string.includes(name)) {
      parsed[name] = arg(flag, argv)
      if (split.length === 1 && parsed[name]) i++
    }
  }

  return parsed
}

const key = (k) => { try { return hypercoreid.decode(k) } catch { return null } }

module.exports = { runkey, appling, argv, arg, args, key }
