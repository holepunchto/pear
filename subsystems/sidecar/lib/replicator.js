'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { EventEmitter } = require('bare-events')

module.exports = class Replicator extends EventEmitter {
  constructor (drive, opts) {
    super()
    this.drive = drive
    this.appling = !!(opts && opts.appling)
    this.swarm = null
    this.announcing = null
  }

  join (swarm, opts) {
    this.swarm = swarm
    if (!this.announcing) this.announcing = this._join(swarm, opts)
    return this.announcing
  }

  async leave (swarm) {
    this.swarm = null
    if (!this.announcing) return
    await this.announcing
    this.announcing = null
    swarm.leave(this.drive.discoveryKey)
  }

  async _join (swarm, { server }) {
    let done = noop
    try {
      await this.drive.ready()
      LOG.info('sidecar', '- Drive bundle ' + hypercoreid.encode(this.drive.key) + ' core length: ' + this.drive.core.length)
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

    LOG.info('sidecar', '- Sidecar swarm joining discovery key of ' + hypercoreid.encode(this.drive.key))
    // IMPORTANT! join always in client mode
    const topic = swarm.join(this.drive.discoveryKey, { server, client: true, limit: 16 })

    try {
      await topic.flushed()
    } catch {
      fin()
      return
    }

    this.emit('announce')
    swarm.flush().then(fin, fin)
  }
}

function noop () {
}
