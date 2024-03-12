'use strict'
const teardown = global.Bare ? require('./teardown') : Function.prototype

class API {
  #rpc = null
  #ctx = null
  #unloading = null
  #teardowns = null
  #refs = 0
  config = null
  argv = global.Bare.argv
  async init () {
    this.key = this.#ctx.key?.z32 || 'dev'
    this.config = await this.#rpc.config()
    this.#ctx.update({ config: this.config })
    return this
  }

  constructor (client, context) {
    this.#rpc = client
    this.#ctx = context
    this.#refs = 0
    this.#teardowns = new Promise((resolve) => { this.#unloading = resolve })
    teardown(() => this.#unload())
  }

  #ref () {
    this.#refs++
    if (this.#refs === 1) {
      this.#rpc.ref()
    }
  }

  #unref () {
    this.#refs--
    if (this.#refs === 0) {
      this.#rpc.unref()
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

  message = (msg) => this.#reftrack(this.#rpc.message(msg))

  messages = (pattern, listener) => {
    if (typeof pattern === 'function') {
      listener = pattern
      pattern = {}
    }
    const subscriber = this.#reftrack(this.#rpc.messages(pattern))
    if (typeof listener === 'function') subscriber.on('data', listener)
    return subscriber
  }

  checkpoint = (state) => {
    this.config.checkpoint = state
    return this.#reftrack(this.#rpc.checkpoint(state))
  }

  versions = () => this.#reftrack(this.#rpc.versions())

  restart = (opts = {}) => this.#reftrack(this.#rpc.restart(opts))

  updates = (listener) => this.messages({ type: 'pear/updates' }, listener)

  wakeups = (listener) => this.messages({ type: 'pear/wakeup' }, listener)

  teardown = (fn) => {
    if (typeof fn === 'function') this.#teardowns = this.#teardowns.then(fn)
    return this.#teardowns
  }

  exit = (code) => Bare.exit(code)
}

module.exports = API
