const pack = require('bare-pack-drive')
const traverse = require('bare-module-traverse')
const lex = require('bare-module-lexer')

module.exports = class TreeShaker {
  constructor (drive, entrypoints) {
    this._drive = drive
    this._entrypoints = entrypoints
  }

  async run () {
    const entrypoints = this._entrypoints
    const target = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64', 'win32-x64']
    const builtins = [
      'net', 'assert', 'console', 'events', 'fs', 'fs/promises', 'http', 'https', 'os', 'util',
      'path', 'child_process', 'repl', 'url', 'tty', 'module', 'process', 'timers', 'inspector', 'crc-universal'
    ]

    const files = (await Promise.all(
      entrypoints.map(async (entrypoint) => {
        const bundle = await pack(this._drive, entrypoint, { builtins, target, resolve })
        return Object.keys(bundle.files)
      })
    )).flat()

    return [...this._entrypoints, ...files]
  }
}

function resolve (entry, parentURL, opts = {}) {
  let extensions
  let conditions = opts.target.reduce((acc, host) => {
    acc.push(['node', ...host.split('-')])
    acc.push(['node', 'bare', ...host.split('-')])
    acc.push(['module', ...host.split('-')])
    return acc
  }, [])

  if (entry.type & lex.constants.ADDON) {
    extensions = ['.node', '.bare']
    conditions = conditions.map((conditions) => ['addon', ...conditions])

    return traverse.resolve.addon(entry.specifier || '.', parentURL, {
      extensions,
      conditions,
      hosts: opts.target,
      linked: false,
      ...opts
    })
  }

  if (entry.type & lex.constants.ASSET) {
    conditions = conditions.map((conditions) => ['asset', ...conditions])
  } else {
    extensions = ['.js', '.cjs', '.mjs', '.json', '.node', '.bare']

    if (entry.type & lex.constants.REQUIRE) {
      conditions = conditions.map((conditions) => ['require', ...conditions])
    } else if (entry.type & lex.constants.IMPORT) {
      conditions = conditions.map((conditions) => ['import', ...conditions])
    }
  }

  return traverse.resolve.module(entry.specifier, parentURL, {
    extensions,
    conditions,
    ...opts
  })
}
