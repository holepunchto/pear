const { extname } = require('bare-path')
const unixPathResolve = require('unix-path-resolve')
const lex = require('bare-module-lexer')
const pack = require('bare-pack-drive')
const traverse = require('bare-module-traverse')

module.exports = class TreeShaker {
  constructor (drive, entrypoints) {
    this._drive = drive
    this._entrypoints = entrypoints
  }

  async run () {
    const entrypoints = await this._extractJSFromHTML(this._entrypoints)
    const target = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64', 'win32-x64']
    const builtins = [
      'net', 'assert', 'console', 'events', 'fs', 'fs/promises', 'http', 'https', 'os',
      'path', 'child_process', 'repl', 'url', 'tty', 'module', 'process', 'timers', 'inspector'
    ]

    const files = (await Promise.all(
      entrypoints.map(async (entrypoint) => {
        const bundle = await pack(this._drive, entrypoint, { builtins, target, resolve })
        return Object.keys(bundle.files)
      })
    )).flat()

    return [...this._entrypoints, ...files]
  }

  async _extractJSFromHTML (entrypoints) {
    const expandedEntrypoints = []
    for (const entrypoint of entrypoints) {
      if (this._isHTML(entrypoint)) {
        const html = await this._drive.get(unixPathResolve('/', entrypoint))
        if (html) expandedEntrypoints.push(...this._sniffJS(html.toString()))
      } else {
        expandedEntrypoints.push(entrypoint)
      }
    }
    return expandedEntrypoints
  }

  _isJS (path) {
    return extname(path) === '.js' || extname(path) === '.mjs'
  }

  _isHTML (path) {
    return extname(path) === '.html'
  }

  _isCustomScheme (str) {
    return /^[a-z][a-z0-9]+:/i.test(str)
  }

  _sniffJS (src) {
    const s1 = src.match(/"[^"]+"/ig)
    const s2 = src.match(/'[^']+'/ig)

    const entries = []

    if (s1) {
      for (const s of s1) {
        if (/\.(m|c)?js"$/.test(s)) {
          entries.push(s.slice(1, -1))
        }
      }
    }

    if (s2) {
      for (const s of s2) {
        if (/\.(m|c)?js'$/.test(s)) {
          entries.push(s.slice(1, -1))
        }
      }
    }

    return entries.filter(e => !this._isCustomScheme(e))
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
