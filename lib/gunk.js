'use strict'
const { isBare } = require('which-runtime')
const defaults = require('script-linker/defaults')
const link = require('script-linker/link')
const unixPathResolve = require('unix-path-resolve')
const platformRoot = unixPathResolve(__dirname, '..')

const api = {
  app: unixPathResolve(__dirname, '../api/app.js'),
  gui: unixPathResolve(__dirname, '../api/gui.js'),
  gizmos: unixPathResolve(__dirname, '../api/gizmos.js')
}

const bmap = isBare
  ? {
      fs: 'bare-fs',
      'fs/promises': 'bare-fs/promises',
      path: 'bare-path',
      os: 'bare-os',
      events: 'bare-events',
      http: 'bare-http1',
      https: 'bare-http1',
      module: 'bare-module',
      child_process: 'bare-subprocess'
    }
  : {}

const overrides = [
  'pear', 'electron',
  'crc-universal', 'quickbit-universal', 'sodium-native', 'udx-native', 'fs-native-extensions',
  'assert', 'console', 'events', 'fs', 'fs/promises', 'http', 'os', 'path', 'child_process',
  'repl', 'url', 'tty', 'module', 'process', 'timers', 'inspector'
]

const builtins = {
  has (ns) {
    return overrides.includes(ns) || defaults.builtins.has(ns)
  },
  get (ns) {
    switch (ns) {
      case 'pear': return require('./pear.js')
      case 'crc-universal': return require('crc-universal')
      case 'quickbit-universal': return require('quickbit-universal')
      case 'sodium-native': return require('sodium-native')
      case 'udx-native': return require('udx-native')
      case 'fs-native-extensions': return require('fs-native-extensions')
      default: return Object.hasOwn(bmap, ns) ? require(bmap[ns]) : defaults.builtins.get(ns)
    }
  },
  keys () { return Array.from(new Set([...defaults.builtins.keys(), ...overrides])) }
}

const bareBuiltins = {
  has (ns) { return ns === 'electron' || defaults.builtins.has(ns) },
  get (ns) { return ns === 'electron' ? builtins.get(ns) : defaults.builtins.get(ns) },
  keys () { return [...defaults.builtins.keys(), 'electron'] }
}

const mapImport = function (id) {
  if (id.includes(':') === false) return id
  const { protocol, transform: ns } = link.parse(id)
  // TODO: holepunch:// protocol is legacy, remove
  if (protocol !== 'holepunch') return id
  if (Object.hasOwn(api, ns) === false) return id
  const path = (platformRoot === '/') ? api[ns] : api[ns].slice(platformRoot.length)
  return `${path}+${protocol}+esm`
}

const platform = {
  symbol: `platform-${defaults.symbol}`,
  protocol: 'holepunch',
  map (id, { protocol, isImport, isBuiltin, isSourceMap, isConsole }) {
    const type = isConsole ? protocol : (isSourceMap ? 'map' : isImport ? 'esm' : 'cjs')
    return `${isBuiltin ? '/~' : ''}${encodeURI(id)}+${protocol}+${type}`
  },
  mapImport,
  runtimes: ['node', 'holepunch']
}

const app = {
  symbol: defaults.symbol,
  protocol: defaults.protocol,
  map (id, { protocol, isImport, isBuiltin, isSourceMap, isConsole }) {
    const type = isConsole ? protocol : (isSourceMap ? 'map' : isImport ? 'esm' : 'cjs')
    return `${isBuiltin ? '/~' : ''}${encodeURI(id)}+${protocol}+${type}`
  },
  mapImport,
  runtimes: ['node', 'holepunch']
}

module.exports = {
  api,
  overrides,
  builtins,
  bareBuiltins,
  platform,
  app
}
