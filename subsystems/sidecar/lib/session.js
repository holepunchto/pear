'use strict'
const safetyCatch = require('safety-catch')
const { ERR_INTERNAL_ERROR } = require('../../../errors')
module.exports = class Session {
  constructor (client) {
    this.client = client
    this.resources = new Set()
    this._eagerTeardownBound = this._eagerTeardown.bind(this)
    this._tearingDown = null
    this._teardowns = []
    client.on('close', this._eagerTeardownBound)
  }

  get closed () {
    return this.client.closed
  }

  async add (resource) {
    await resource.ready()

    if (this.closed) {
      await resource.close()
      throw ERR_INTERNAL_ERROR('Session is closed')
    }

    this.resources.add(resource)
    return resource
  }

  async delete (resource) {
    this.resources.delete(resource)
    await resource.close()
  }

  close () {
    this._eagerTeardown()
    return this._tearingDown
  }

  _eagerTeardown () {
    if (this._tearingDown) return
    this.client.off('close', this._eagerTeardownBound)
    this._tearingDown = this._teardown()
    this._tearingDown.catch(safetyCatch)
  }

  teardown (fn) {
    this._teardowns.push(fn)
  }

  async _teardown () {
    const closing = []
    for (const resource of this.resources) {
      const close = resource.close()
      closing.push(close)
    }
    for (const fn of this._teardowns) {
      closing.push(fn())
    }
    for (const { status, reason } of await Promise.allSettled(closing)) {
      if (status === 'rejected') throw reason
    }
  }
}
