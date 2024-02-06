'use strict'
class API {
  #ipc = null
  #ctx = null
  #id = null
  config = null
  preferences = null
  stdio = require('./stdio')
  async init () {
    this.#id = this.#ctx.id
    this.key = this.#ctx.key?.z32 || 'dev'
    this.preferences = new Preferences(this.#id, this.#ipc)
    this.config = await this.#ipc.request({ channel: `${this.#id}:app:config` })
    this.#ctx.update({ config: this.config })
    return this
  }

  constructor (client, context) {
    this.#ipc = client
    this.#ctx = context
  }

  message = (msg) => this.#ipc.request({ channel: `${this.#id}:app:message` }, msg)

  messages = (pattern, listener) => {
    if (typeof pattern === 'function') {
      listener = pattern
      pattern = {}
    }
    const subscriber = this.#ipc.iterable(`${this.#id}:app:messages`, pattern) // TODO: crank iterable needs to return iambus subscriber
    if (typeof listener === 'function') subscriber.on('data', listener)
    return subscriber
  }

  checkpoint = (state) => this.#ipc.request({ channel: `${this.#id}:app:checkpoint` }, state)

  versions = async () => this.#ipc.request({ channel: `${this.#id}:app:versions` })

  restart = async () => this.#ipc.request({ channel: `${this.#id}:app:restart` })
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
    return this.#ipc.iterable(`${this.#id}:app:preferencesUpdates`)
  }

  set (key, value) {
    return this.#ipc.request({ channel: `${this.#id}:app:setPreference` }, key, value)
  }

  get (key) {
    return this.#ipc.request({ channel: `${this.#id}:app:getPreference` }, key)
  }

  del (key) {
    return this.set(key, null)
  }

  list () {
    return this.#ipc.iterable(`${this.#id}:app:iteratePreferences`)
  }
}

module.exports = API
