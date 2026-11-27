'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { EventEmitter } = require('bare-events')

module.exports = class Replicator extends EventEmitter {
  static openDiscovery(drive, swarm, opts) {
    const replicator = new Replicator(drive)
    replicator._openDiscovery(swarm, opts)
    return replicator
  }

  constructor(drive) {
    super()
    this.drive = drive
    this.discovery = null
    this.announcing = null
    this.leaving = null
  }

  join(swarm, opts) {
    if (this.leaving) return this.leaving.then(() => this.join(swarm, opts))
    if (!this.announcing) {
      this.announcing = this._join(swarm, opts).catch((err) =>
        LOG.error('internal', 'Replicator join error', err)
      )
    }
    return this.announcing
  }

  leave() {
    if (!this.discovery && !this.announcing) return Promise.resolve()
    if (this.leaving) return this.leaving
    this.leaving = (this.discovery ? this.discovery.destroy() : this.announcing)
      .catch((err) => LOG.error('internal', 'Replicator leave error', err))
      .finally(() => {
        this.discovery = null
        this.announcing = null
        this.leaving = null
      })
    return this.leaving
  }

  async _join(swarm, { server, client }) {
    let done = noop
    try {
      await this.drive.ready()
      if (this.leaving) return
      LOG.info(
        'sidecar',
        '- Replicator: drive = ' +
          this.drive.core.fork +
          '.' +
          this.drive.core.length +
          '.' +
          hypercoreid.encode(this.drive.key)
      )
      if (this.drive.core.length === 0) done = this.drive.findingPeers()
    } catch {
      done()
      return
    }

    let called = false
    const fin = () => {
      if (called) return
      called = true
      done()
    }

    LOG.info('sidecar', '- Swarm join dkey of: ' + hypercoreid.encode(this.drive.key))
    try {
      const discovery = this._openDiscovery(swarm, { server, client, limit: 16 })
      await discovery.flushed()
      if (discovery.destroyed || discovery.discovery.destroyed || swarm.destroyed) return fin()
    } catch (err) {
      fin()
      throw err
    }

    this.emit('announce')
    swarm.flush().then(fin, fin)
  }

  _openDiscovery(swarm, opts) {
    const discovery = this.discovery
    if (!discovery || discovery.destroyed || discovery.discovery.destroyed) {
      this.discovery = swarm.join(this.drive.discoveryKey, opts)
    }
    return this.discovery
  }

  ready() {}

  close() {
    return this.leave()
  }
}

function noop() {}
