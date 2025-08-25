const { extname } = require('bare-path')
const resolve = require('unix-path-resolve')
const DependencyStream = require('dependency-stream')

module.exports = class TreeShaker {
  constructor (drive, entrypoints) {
    this._drive = drive
    this._entrypoints = entrypoints
  }

  async run () {
    const entrypoints = await this._extractJSFromHTML(this._entrypoints)
    const files = (await Promise.all(
      entrypoints.map(async (e) => {
        const deps = []
        const bareDependencyStream = new DependencyStream(this._drive, { runtimes: ['bare'], entrypoint: e, packages: true })
        for await (const dep of bareDependencyStream) {
          deps.push(dep.key)
        }

        const nodeDependencyStream = new DependencyStream(this._drive, { runtimes: ['node'], entrypoint: e, packages: true })
        for await (const dep of nodeDependencyStream) {
          deps.push(dep.key)
        }
        return [...new Set(deps)] // remove bare/node duplicates
      })
    )).flat()
    return [...this._entrypoints, ...files]
  }

  async _extractJSFromHTML (entrypoints) {
    const expandedEntrypoints = []
    for (const entrypoint of entrypoints) {
      if (this._isHTML(entrypoint)) {
        const html = await this._drive.get(resolve('/', entrypoint))
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
