'use strict'
const { EventEmitter } = require('bare-events')

const SEED_LINGER = 60 * 1000

module.exports = class Replicator extends EventEmitter {
  constructor (drive, opts) {
    super()
    this.drive = drive
    this.appling = !!(opts && opts.appling)
    this.swarm = null
    this.announcing = null
    this.fullySwarming = false
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
    this.fullySwarming = false
    this.announcing = null
    swarm.leave(this.drive.discoveryKey)
  }

  async _join (swarm, { announceSeeds, server, client }) {
    let done = noop
    try {
      await this.drive.ready()
      if (this.drive.core.length === 0) done = this.drive.findingPeers()
    } catch {
      done()
      return
    }

    console.log('yo?')
    let called = false
    const fin = () => {
      if (called) return
      called = true
      done()
    }

    const topic = swarm.join(this.drive.discoveryKey, { server, client })

    this.fullySwarming = true
    await topic.flushed()

    // if good network join as server always
    if (!this.appling && (swarm.dht.port > 0 && swarm.dht.host)) await swarm.join(this.drive.discoveryKey, { client: true, server: true }).flushed()

    this.emit('announce')
    swarm.flush().then(fin, fin)
  }
}

function noop () {
}
