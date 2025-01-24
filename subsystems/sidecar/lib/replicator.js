'use strict'
const { EventEmitter } = require('bare-events')
const Seeders = require('@hyperswarm/seeders')

const SEED_LINGER = 60 * 1000

module.exports = class Replicator extends EventEmitter {
  constructor (drive, opts) {
    super()
    this.drive = drive

    const active = this._active.bind(this)

    drive.core.onwait = active
    drive.core.on('download', active)

    drive.on('blobs', (blobs) => {
      blobs.core.onwait = active
      blobs.core.on('download', active)
    })

    this.seeders = null
    this.appling = !!(opts && opts.appling)
    this.swarm = null
    this.announcing = null
    this.fullySwarming = false
    this.onappend = null
    this.linger = false
    this.resumedOnce = false

    drive.core.on('append', () => this._active())
  }

  _active (seq) {
    this.linger = true
    if (!this.fullySwarming || !this.seeders) return
    this.resumedOnce = true
    this.seeders.resume()
    this.seeders.pause({ timeout: SEED_LINGER, drop: true })
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
    if (this.seeders) {
      await this.seeders.destroy()
      this.seeders = null
    }
    if (this.onappend) {
      this.drive.core.removeListener('append', this.onappend)
      this.onappend = null
    }
    this.fullySwarming = false
    this.announcing = null
    swarm.leave(this.drive.discoveryKey)
  }

  async _join (swarm, { announceSeeds, server, client }) {
    let done = () => {}
    try {
      await this.drive.ready()
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

    let owner = !!announceSeeds && this.drive.core.writable
    let keyPair = swarm.dht.defaultKeyPair

    if (owner) {
      try {
        keyPair = await this._getKeyPair()
      } catch {
        owner = false
      }
    }

    this.seeders = new Seeders(owner ? keyPair : this.drive.key, {
      dht: swarm.dht,
      keyPair: await this.drive.corestore.createKeyPair('seeder-swarm')
    })

    this.seeders.on('connection', (c) => {
      this.drive.corestore.replicate(c)
    })

    const topic = swarm.join(this.drive.discoveryKey, { server, client })

    this.seeders.on('update', (r) => {
      if (!r.core || owner) return

      if (this.drive.core.fork < r.core.fork) {
        this.seeders.resume() // safe to resume here as this will get the truncate proof and then shutdown (through onappend)
      } else if (this.drive.core.fork === r.core.fork && this.drive.core.length < r.core.length) {
        this.seeders.resume() // safe to resume here as this will get the length proof and then shutdown (through onappend)
      } else {
        if (this.linger) this._active()
        else this.seeders.pause()
      }
    })

    if (owner) {
      await this.seeders.join({
        seeds: announceSeeds,
        core: {
          length: this.drive.core.length,
          fork: this.drive.core.fork
        }
      })

      const onappend = () => {
        this.seeders.join({
          seeds: announceSeeds,
          core: {
            length: this.drive.core.length,
            fork: this.drive.core.fork
          }
        })
      }

      this.onappend = onappend
      this.drive.core.on('append', this.onappend)
    } else {
      await this.seeders.join()
    }

    if (this.seeders.core) {
      if (this.drive.core.fork > this.seeders.core.fork) {
        fin()
      } else if (this.drive.core.fork === this.seeders.core.fork && this.drive.core.length >= this.seeders.core.length) {
        fin()
      }
    }

    this.fullySwarming = true
    await topic.flushed()

    // if good network, or no seeders join as server
    if (owner || !this.seeders.seeds || !this.seeders.seeds.length || (swarm.dht.port > 0 && swarm.dht.host)) {
      // for now do not announce if appling, we so lean into it
      if (!this.appling) await swarm.join(this.drive.discoveryKey, { client: true, server: true }).flushed()
    }

    this.emit('announce')
    this._flushBg(swarm, fin)
  }

  _flushBg (swarm, done) {
    const onflush = () => {
      // prob not needed, but also doesn't really hurt - just in case we have some timing things above waiting for flush etc
      if (this.linger && !this.resumedOnce) this._active()
      done()
    }

    Promise.all([this.seeders.flush(), swarm.flush()]).then(onflush, onflush)
  }

  async _getKeyPair () {
    const name = await this.drive.core.getUserData('corestore/name')
    const namespace = await this.drive.core.getUserData('corestore/namespace')
    const keyPair = await this.drive.corestore.createKeyPair(name, namespace)

    return keyPair
  }
}
