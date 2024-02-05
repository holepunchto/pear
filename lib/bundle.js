const { SWAP } = require('./constants.js')
const ReadyResource = require('ready-resource')
const Hyperdrive = require('hyperdrive')
const DriveBundler = require('drive-bundler')

module.exports = class Bundle extends ReadyResource {
  constructor (drive, swarm) {
    super()
    this.drive = drive
    this.swarm = swarm
    this.replicating = null
  }

  static fromKey (store, key, swarm) {
    const drive = new Hyperdrive(store.session(), key)
    return new this(drive, swarm)
  }

  async _open () {
    await this.drive.ready()
  }

  async _close () {
    await this.drive.close()
    if (this.replicating) {
      await this.replicating.destroy()
      this.replicating = null
    }
  }

  async replicate () {
    if (!this.opened) await this.ready()
    if (this.replicating) return

    const done = this.drive.findingPeers()

    this.replicating = this.swarm.join(this.drive.discoveryKey, { client: true, server: true })
    this.swarm.flush().then(done, done)
  }

  async bundle () {
    if (!this.opened) await this.ready()

    const res = await DriveBundler.bundle(this.drive, {
      entrypoint: '.',
      cwd: SWAP,
      absolutePrebuilds: true,
      mount: 'pear://' + this.drive.id
    })

    return { key: this.drive.id, ...res }
  }
}