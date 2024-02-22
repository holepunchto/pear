'use strict'
const goodbye = require('./teardown')

class API {
  #ipc = null
  #ctx = null
  #id = null
  #unloading = null
  #teardowns = null
  config = null
  argv = global.Bare.argv
  async init () {
    this.#id = this.#ctx.id
    this.key = this.#ctx.key?.z32 || 'dev'
    this.config = await this._request({ channel: `${this.#id}:app:config` })
    this.#ctx.update({ config: this.config })
    return this
  }

  constructor (client, context) {
    this.#ipc = client
    this.#ctx = context
    this.refs = 0
    this._ref()
    this._unref()
    this.#teardowns = new Promise((resolve) => { this.#unloading = resolve })
    goodbye(() => this.#unload())
  }

  async #unload() {
  this.#unloading();

  const MAX_TEARDOWN_WAIT = 5000;
  const timeout = new Promise(resolve => setTimeout(() => {
    console.error(`Max teardown wait reached after ${MAX_TEARDOWN_WAIT} ms. Exiting...`);
    resolve();
  }, MAX_TEARDOWN_WAIT));

  await Promise.race([this.#teardowns, timeout]);
}

  _ref () {
    this.refs++
    if (this.refs === 1) {
      this.#ipc.client.protomux.stream.rawStream.ref()
    }
  }

  _unref () {
    this.refs--
    if (this.refs === 0) {
      this.#ipc.client.protomux.stream.rawStream.unref()
    }
  }

  async _request (...args) {
    this._ref()
    try {
      return await this.#ipc.request(...args)
    } finally {
      this._unref()
    }
  }

  _iterable (...args) {
    const stream = this.#ipc.iterable(...args)
    this._ref()
    stream.on('close', () => { this._unref() })
    return stream
  }

  message = (msg) => this._request({ channel: `${this.#id}:app:message` }, msg)

  messages = (pattern, listener) => {
    if (typeof pattern === 'function') {
      listener = pattern
      pattern = {}
    }
    const subscriber = this._iterable(`${this.#id}:app:messages`, pattern)
    if (typeof listener === 'function') subscriber.on('data', listener)
    return subscriber
  }

  checkpoint = (state) => {
    this.config.checkpoint = state
    return this._request({ channel: `${this.#id}:app:checkpoint` }, state)
  }

  versions = async () => this._request({ channel: `${this.#id}:app:versions` })

  restart = async (opts = {}) => this._request({ channel: `${this.#id}:app:restart`, ...opts })

  updates = (listener) => this.messages({ type: 'pear/updates' }, listener)

  teardown = (fn) => { this.#teardowns = this.#teardowns.then(fn) }
}

module.exports = API
