'use strict'
const constants = require('../lib/constants')
const Context = require('../ctx/shared')
const API = require('../lib/api')
const { isBare } = require('which-runtime')
const Module = isBare ? require('bare-module') : null
const os = isBare ? require('bare-os') : require('os')
const path = isBare ? require('bare-path') : require('path')
const fs = isBare ? require('bare-fs') : require('fs')
const ENV = isBare ? require('bare-env') : process.env
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { Readable } = require('streamx')
const fsext = require('fs-native-extensions')

class Crank {
  starting = null
  usage = null
  constructor (client) {
    this.client = client
  }

  async * run ({ args }) {
    const cwd = isBare ? os.cwd() : global.process.cwd()
    args.unshift('--run')

    const { startId, host, id, type, bundle } = await this.start(args, ENV, cwd)

    if (type === 'terminal') {
      const ctx = new Context({ argv: args })

      ctx.update({ host, id })

      if (ctx.error) {
        console.error(ctx.error)
        global.process?.exit(1) || global.Bare.exit(1)
        return
      }

      const pear = new API(this, ctx)
      await pear.init()
      global.Pear = pear

      const protocol = new Module.Protocol({
        exists (url) {
          return Object.hasOwn(bundle.sources, url.href)
        },
        read (url) {
          return bundle.sources[url.href]
        }
      })

      Module.load(new URL(bundle.entrypoint), {
        protocol,
        resolutions: bundle.resolutions
      })
      return
    }

    args.unshift('--start-id=' + startId)

    const iterable = new Readable({ objectMode: true })
    args = [path.resolve(__dirname, '..'), ...args]
    const child = spawn(constants.DESKTOP_RUNTIME, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      ...{ env: { ...ENV, NODE_PRESERVE_SYMLINKS: 1 } }
    })
    child.once('exit', (code) => { iterable.push({ tag: 'exit', data: { code } }) })
    child.stdout.on('data', (data) => { iterable.push({ tag: 'stdout', data }) })
    child.stderr.on('data', (data) => {
      const str = data.toString()
      const ignore = str.indexOf('DevTools listening on ws://') > -1 ||
        str.indexOf('NSApplicationDelegate.applicationSupportsSecureRestorableState') > -1 ||
        str.indexOf('devtools://devtools/bundled/panels/elements/elements.js') > -1 ||
        str.indexOf('sysctlbyname for kern.hv_vmm_present failed with status -1') > -1
      if (ignore) return
      iterable.push({ tag: 'stderr', data })
    })

    yield * iterable
  }

  address () {
    return this.client.request('address')
  }

  identify () {
    return this.client.request('identify')
  }

  start (...args) {
    return this.client.request('start', { args })
  }

  wakeup (link, storage, appdev) {
    return this.client.request('wakeup', { args: [link, storage, appdev] })
  }

  unloading () {
    return this.client.request('unloading', {}, { errorlessClose: true })
  }

  async closeClients () {
    return this.client.request('closeClients')
  }

  async shutdown () {
    if (this.client.closed) return
    this.client.notify('shutdown')

    const fd = await new Promise((resolve, reject) => fs.open(path.join(constants.PLATFORM_DIR, 'corestores', 'platform', 'primary-key'), 'r+', (err, fd) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fd)
    }))

    await fsext.waitForLock(fd)

    await new Promise((resolve, reject) => fs.close(fd, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    }))
  }

  respond (channel, responder) {
    return this.client.method(channel, responder)
  }

  unrespond (channel) {
    return this.client.method(channel, null)
  }

  request (params) {
    return this.client.request(params.channel, params)
  }

  notify (params) {
    return this.client.notify('request', params)
  }

  repl () { return this.client.request('repl') }

  release (params, opts) { return this.#op('release', params, opts) }

  stage (params, opts) { return this.#op('stage', params, opts) }

  seed (params, opts) { return this.#op('seed', params, opts) }

  info (params, opts) { return this.#op('info', params, opts) }

  dump (params, opts) { return this.#op('dump', params, opts) }

  iterable (channel, params, { eager = false } = {}) {
    const stream = new Readable()
    const promise = this._iterable(stream, channel, params, { eager })
    promise.catch((err) => stream.destroy(err))
    return stream
  }

  async _iterable (stream, channel, params, { eager = false } = {}) {
    let tick = null
    let incoming = new Promise((resolve) => { tick = resolve })
    const payloads = []
    const responder = (payload) => {
      payloads.push(payload)
      tick()
      incoming = new Promise((resolve) => { tick = resolve })
    }
    this.respond(`${channel}:iterable`, responder)
    this.client.notify('iterable', { channel, params, eager })
    try {
      do {
        while (payloads.length > 0) {
          const payload = payloads.shift()
          if (payload === null) return // end of iterable
          stream.push(payload.value)
        }
        await incoming
      } while (true)
    } finally {
      this.unrespond(`${channel}:iterable`)
    }
  }

  async * #op (name, params, { close = true } = {}) {
    let tick = null
    let incoming = new Promise((resolve) => { tick = resolve })
    const payloads = []
    const responder = (payload) => {
      payloads.push(payload)
      tick()
      incoming = new Promise((resolve) => { tick = resolve })
    }

    const rcv = `${name}:${params.id}`
    this.respond(rcv, responder)
    this.client.notify(name, params)

    try {
      do {
        while (payloads.length > 0) {
          const payload = payloads.shift()
          if (payload === null) return
          yield payload.value
        }
        await incoming
      } while (true)
    } finally {
      this.unrespond(rcv)
      if (close) this.close()
    }
  }

  close () {
    return this.client.close()
  }
}

module.exports = Crank
