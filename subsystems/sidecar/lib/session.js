'use strict'
const safetyCatch = require('safety-catch')
const { ERR_INTERNAL_ERROR } = require('pear-errors')
module.exports = class Session {
  constructor(client, identifier = '') {
    this.client = client
    this.resources = new Set()
    this._eagerTeardownBound = this._eagerTeardown.bind(this)
    this._tearingDown = null
    this._teardowns = []
    this._identifier = identifier
    LOG.info('session', 'new session', this._identifier)
    client.on('close', this._eagerTeardownBound)
  }

  get closed() {
    return this.client.closed
  }

  async add(resource) {
    LOG.info('session', 'adding resource to session', this._identifier)
    await resource.ready()

    if (this.closed) {
      LOG.info(
        'session',
        'closed, closing resource and not adding to session',
        this._identifier
      )
      await resource.close()
      throw ERR_INTERNAL_ERROR('Session is closed')
    }

    this.resources.add(resource)
    LOG.info('session', 'resource added to session', this._identifier)
    return resource
  }

  async delete(resource) {
    LOG.info('session', 'removing resource from session', this._identifier)
    this.resources.delete(resource)
    await resource.close()
    LOG.info(
      'session',
      'resource closed and removed from session',
      this._identifier
    )
  }

  async close() {
    this._eagerTeardown()
    try {
      return await this._tearingDown
    } finally {
      LOG.info('session', 'closed session', this._identifier)
    }
  }

  _eagerTeardown() {
    if (this._tearingDown) return
    this.client.off('close', this._eagerTeardownBound)
    this._tearingDown = this._teardown()
    this._tearingDown.catch(safetyCatch)
  }

  teardown(fn) {
    this._teardowns.push(fn)
  }

  async _teardown() {
    LOG.info('session', 'tearing down session', this._identifier)
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
    this._teardowns = []
  }
}
