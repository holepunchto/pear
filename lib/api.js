'use strict'
const Worker = require('./worker')
const { BARE_RESTART_EXIT_CODE } = require('../constants')
const noop = () => {}
const teardown = global.Bare ? require('./teardown') : noop
const program = global.Bare || global.process

class Identity {
  #reftrack = null
  #ipc = null
  constructor ({ reftrack = noop, ipc = null } = {}) {
    this.#reftrack = reftrack
    this.#ipc = ipc
  }

  request = (publicKey) => this.#reftrack(this.#ipc.requestIdentity({ publicKey }))
  share = (identity) => this.#reftrack(this.#ipc.shareIdentity(identity))
  clear = () => this.#reftrack(this.#ipc.clearIdentity())
}

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
    this.key = this.#state.key ? (this.#state.key.type === 'Buffer' ? Buffer.from(this.#state.key.data) : this.#state.key) : null
    this.config = state.config
    this.worker = new Worker({ ref: () => this.#ref(), unref: () => this.#unref() })
    this.identity = new Identity({ reftrack: (promise) => this.#reftrack(promise), ipc: this.#ipc })
    this.#teardowns = new Promise((resolve) => { this.#unloading = resolve })
    onteardown(() => this.#unload())
    this.#ipc.unref()
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

    const MAX_TEARDOWN_WAIT = 15000
    let timeout = null
    let timedout = false
    const countdown = new Promise((resolve) => {
      timeout = setTimeout(() => {
        timedout = true
        resolve()
      }, MAX_TEARDOWN_WAIT)
    })
    this.#teardowns.finally(() => { clearTimeout(timeout) })
    await Promise.race([this.#teardowns, countdown])
    if (timedout) {
      console.error(`Max teardown wait reached after ${MAX_TEARDOWN_WAIT} ms. Exiting...`)
      if (global.Bare) {
        Bare.exit(1)
      } else {
        process.exit(1)
      }
    }
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

  restart = async (opts = {}) => {
    const restart = this.#reftrack(this.#ipc.restart({ ...opts, hard: true }))
    return restart
  }

  reload = async (opts = {}) => {
    if (!opts.platform) {
      // TODO: use Pear.shutdown when it lands instead
      if (this.#state.type === 'terminal') Bare.exit(BARE_RESTART_EXIT_CODE)
      else global.location.reload()

      return
    }

    return this.#reftrack(this.#ipc.restart({ ...opts, hard: false }))
  }

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
