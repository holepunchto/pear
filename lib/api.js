'use strict'
const Worker = require('./worker')
const teardown = global.Bare ? require('./teardown') : Function.prototype
const program = global.Bare || global.process

class API {
  #ipc = null
  #state = null
  #unloading = null
  #teardowns = null
  #refs = 0
  config = null
  argv = program.argv

  constructor (ipc, state, onteardown = teardown) {
    this.#ipc = ipc
    this.#state = state
    this.#refs = 0
    this.key = this.#state.key?.z32 || 'dev'
    this.config = state.config
    this.worker = new Worker({ ref: () => this.#ref(), unref: () => this.#unref() })
    this.#teardowns = new Promise((resolve) => { this.#unloading = resolve })
    onteardown(() => this.#unload())
  }

  #ref () {
    this.#refs++
    if (this.#refs === 1) {
      this.#ipc.ref()
    }
  }

  #unref () {
    this.#refs--
    if (this.#refs === 0) {
      this.#ipc.unref()
    }
  }

  async #unload () {
    this.#unloading()

    const MAX_TEARDOWN_WAIT = 5000
    const timeout = new Promise(resolve => setTimeout(() => {
      console.error(`Max teardown wait reached after ${MAX_TEARDOWN_WAIT} ms. Exiting...`)
      resolve()
    }, MAX_TEARDOWN_WAIT))

    await Promise.race([this.#teardowns, timeout])
  }

  async #reftrack (promise) {
    this.#ref()
    try {
      return await promise
    } finally {
      this.#unref()
    }
  }

  message = (msg) => this.#reftrack(this.#ipc.message(msg))

  messages = (pattern, listener) => {
    if (typeof pattern === 'function') {
      listener = pattern
      pattern = {}
    }
    this.#ref()
    const subscriber = this.#ipc.messages(pattern)
    subscriber.on('close', () => this.#unref())
    if (typeof listener === 'function') subscriber.on('data', listener)
    return subscriber
  }

  checkpoint = (state) => {
    this.config.checkpoint = state
    return this.#reftrack(this.#ipc.checkpoint(state))
  }

  versions = () => this.#reftrack(this.#ipc.versions())

  restart = (opts = {}) => this.#reftrack(this.#ipc.restart(opts))

  updates = (listener) => this.messages({ type: 'pear/updates' }, listener)

  wakeups = (listener) => this.messages({ type: 'pear/wakeup' }, listener)

  teardown = (fn) => {
    if (typeof fn === 'function') this.#teardowns = this.#teardowns.then(fn)
    return this.#teardowns
  }

  exit = (code) => program.exit(code)

  // DEPRECATED - assess to remove from Sep 2024
  #preferences = null
  get preferences () {
    if (this.#preferences) return this.#preferences
    this.#preferences = () => this.#ipc.preferences()
    this.#preferences.set = (key, value) => this.#ipc.setPreference(key, value)
    this.#preferences.get = (key) => this.#ipc.getPreference(key)
    this.#preferences.del = (key) => this.#ipc.setPreference(key, null)
    this.#preferences.list = () => this.#ipc.iteratePreferences()
    return this.#preferences
  }
}

module.exports = API
