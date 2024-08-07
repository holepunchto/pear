'use strict'
const http = require('bare-http1')
const ScriptLinker = require('script-linker')
const ReadyResource = require('ready-resource')
const streamx = require('streamx')
const listen = require('listen-async')
const Mime = require('./mime')
const transform = require('../../../lib/transform')
const { ERR_HTTP_BAD_REQUEST, ERR_HTTP_GONE, ERR_HTTP_NOT_FOUND } = require('../../../errors')
const mime = new Mime()

module.exports = class Http extends ReadyResource {
  constructor (sidecar) {
    super()
    this.sidecar = sidecar
    this.ipc = sidecar.ipc
    this.connections = new Set()
    this.server = http.createServer(async (req, res) => {
      try {
        const ua = req.headers['user-agent']
        if (ua.slice(0, 4) !== 'Pear') throw ERR_HTTP_BAD_REQUEST()
        const [url, protocol = 'app', type = 'app'] = req.url.split('+')
        req.url = (url === '/') ? '/index.html' : url
        if (protocol === 'platform-resolve' || protocol === 'holepunch') {
          return await this.#lookup(this.sidecar, protocol === 'platform-resolve' ? 'resolve' : protocol, type, req, res)
        }
        if (protocol !== 'app' && protocol !== 'resolve') {
          throw ERR_HTTP_BAD_REQUEST('Unknown protocol')
        }
        const id = ua.slice(5)

        if (id === 'Platform') return await this.#lookup(this.sidecar, 'holepunch', type, req, res)

        const [clientId, startId] = id.split('@')
        const client = this.ipc.client(clientId)
        if (client === null) throw ERR_HTTP_BAD_REQUEST('Bad Client ID')
        const app = client.userData

        if (app.startId !== startId) throw ERR_HTTP_NOT_FOUND()
        if (app.reported?.err) throw ERR_HTTP_NOT_FOUND('Not Found - ' + (app.reported.err.code || 'ERR_UNKNOWN') + ' - ' + app.reported.err.message)
        if (app.reported && app.state.options.minver) {
          res.setHeader('X-Minver', `key=${app.state.options.minver.key}&length=${app.state.options.minver.length}&fork=${app.state.options.minver.fork}`)
          res.end()
          return
        }
        await app.bundle.ready()
        await this.#lookup(app, protocol, type, req, res)
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
          err.status = err.status || 404
        } else if (err.code === 'SESSION_CLOSED') {
          err.status = err.status || 503
        } else {
          console.error('Unknown Server Error', err)
          err.status = 500
        }

        res.setHeader('Content-Type', 'text/plain')
        res.statusCode = err.status
        res.end(err.message)
      }
    })

    this.server.on('connection', (c) => {
      this.connections.add(c)
      c.on('close', () => this.connections.delete(c))
    })

    this.server.unref()
    this.port = null
    this.host = null
  }

  async #lookup (app, protocol, type, req, res) {
    if (app.closed) throw ERR_HTTP_GONE()
    const { bundle, linker, state } = app
    const locals = { url: req.url, name: state?.name, version: `v.${state?.version?.fork}.${state?.version?.length}.${state?.version?.key}` }
    const url = `${protocol}://${type}${req.url}`
    let link = null
    try { link = ScriptLinker.link.parse(url) } catch { throw ERR_HTTP_BAD_REQUEST(`Bad Request (Malformed URL: ${url})`) }

    const isImport = link.transform === 'esm' || link.transform === 'app'

    let builtin = false
    if (link.filename === null) {
      link.filename = await linker.resolve(link.resolve, link.dirname, { isImport })
      builtin = link.filename === link.resolve && linker.builtins.has(link.resolve)
    }

    let isJS = false
    if (protocol !== 'resolve') {
      const ct = mime.type(link.filename)

      // esm import of wasm returns the wasm file url

      if (ct === 'application/wasm' && link.transform === 'esm') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        link.transform = 'wasm'
        const out = await linker.transform(link)
        res.end(out)
        return
      }

      res.setHeader('Content-Type', ct)
      if (link.transform === 'app') link.transform = 'esm'
      isJS = ct.slice(0, 22) === 'application/javascript'
      if (builtin) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        const out = await linker.transform(link)
        res.end(out)
        return
      }
    }

    if (await bundle.has(link.filename) === false) {
      if (link.filename === '/index.html') {
        const manifest = await bundle.drive.get('/package.json')
        if (typeof manifest?.value?.main === 'string') {
          req.url = `/${manifest?.value?.main}`
          return this.#lookup(app, protocol, type, req, res)
        }
      }
      res.statusCode = 404
      const stream = transform.stream(await this.sidecar.bundle.get('/not-found.html'), locals)
      return await streamx.pipelinePromise(stream, res)
    }

    if (protocol === 'resolve') {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      if (!link.resolve && !link.dirname && !link.filename) {
        res.statusCode = 404
        const stream = transform.stream(await this.sidecar.bundle.get('/not-found.html'), locals)
        return await streamx.pipelinePromise(stream, res)
      }
      res.end(link.filename)
      return
    }

    const isSourceMap = link.transform === 'map'
    if (isJS || isSourceMap) {
      const out = await linker.transform(link)
      if (isSourceMap) res.setHeader('Content-Type', 'application/json')
      res.end(out)
    } else {
      if (protocol === 'app' && (link.filename.endsWith('.html') || link.filename.endsWith('.htm'))) {
        const mods = await linker.warmup(link.filename)
        const batch = []
        for (const [filename, mod] of mods) {
          if (mod.type === 'module') continue
          const source = mod.toCJS()
          batch.push({ filename, source })
        }
        app.warmup({ protocol, batch })
      }
      const stream = await bundle.streamFrom(link.filename)
      await streamx.pipelinePromise(stream, res)
    }
  }

  async _open () {
    try {
      await listen(this.server, 9342, '127.0.0.1')
    } catch {
      await listen(this.server, 0, '127.0.0.1')
    }
    this.port = this.server.address().port
    this.host = `http://127.0.0.1:${this.port}`
  }

  async _close () {
    const serverClosing = new Promise((resolve) => this.server.close(resolve))
    for (const c of this.connections) c.destroy()
    await serverClosing
  }
}
