'use strict'

class API {
  #ipc = null
  #ctx = null
  #id = null
  config = null
  preferences = null

  async init () {
    this.#id = this.#ctx.id
    this.key = this.#ctx.key?.z32 || 'dev'
    this.preferences = new Preferences(this.#id, this.#ipc)
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

  checkpoint = (state) => this._request({ channel: `${this.#id}:app:checkpoint` }, state)

  versions = async () => this._request({ channel: `${this.#id}:app:versions` })

  restart = async (opts = {}) => this._request({ channel: `${this.#id}:app:restart`, ...opts })

  updates = (listener) => this.messages({ type: 'pear/updates' }, listener)

}

class Preferences extends Function {
  #id = null
  #ipc = null
  constructor (id, ipc) {
    super('return this.preferences.updates()')
    this.#id = id
    this.#ipc = ipc
  }

  updates () {
    return this._iterable(`${this.#id}:app:preferencesUpdates`)
  }

  set (key, value) {
    return this._request({ channel: `${this.#id}:app:setPreference` }, key, value)
  }

  get (key) {
    return this._request({ channel: `${this.#id}:app:getPreference` }, key)
  }

  del (key) {
    return this.set(key, null)
  }

  list () {
    return this._iterable(`${this.#id}:app:iteratePreferences`)
  }
}

module.exports = API
