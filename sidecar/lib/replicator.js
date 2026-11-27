'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { EventEmitter } = require('bare-events')

module.exports = class Replicator extends EventEmitter {
  constructor(drive) {
    super()
    this.drive = drive
    this.discovery = null
    this.announcing = null
    this.leaving = null
  }

  get isAnnouncing() {
    const session = this.discovery
    return (
      !!session?.isServer &&
      !session.destroyed &&
      !session.discovery.destroyed &&
      !session.swarm.destroyed
    )
  }

  join(swarm, opts) {
    this.swarm = swarm
    if (!this.announcing) {
      this.announcing = this._join(swarm, opts)
        .then(() => {
          this.leaving = null
        })
        .catch((err) => LOG.error('internal', 'Replicator join error', err))
    }
    return this.announcing
  }

  async leave(swarm) {
    if (this.leaving) return
    this.swarm = null
    if (!this.announcing) return
    await this.announcing
    this.leaving = swarm
      .leave(this.drive.discoveryKey)
      .then(() => {
        this.announcing = null
      })
      .catch((err) => LOG.error('internal', 'Replicator leave error', err))
    return this.leaving
  }

  async _join(swarm, { server, client }) {
    let done = noop
    try {
      await this.drive.ready()
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

    if (this.drive.closing) return fin()
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
    return this.leave(this.swarm)
  }
}

function noop() {}
