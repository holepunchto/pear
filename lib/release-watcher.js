const safetyCatch = require('safety-catch')
const debounceify = require('debounceify')
const Localwatch = require('localwatch')
const { Readable } = require('streamx')

module.exports = function (checkout, drive) {
  if (drive.key) return new DriveReleaseWatcher(checkout, drive)
  return new Localwatch(drive.root, {
    mapReadable () {
      return { key: null, length: 0, fork: 0 }
    }
  })
}

class DriveReleaseWatcher extends Readable {
  constructor (checkout, drive) {
    super()

    this.drive = drive
    this._bumpBound = debounceify(this._bump.bind(this))
    this._checkout = checkout

    this.drive.on('append', this._bumpBound)
    this.drive.on('truncate', this._bumpBound)
  }

  _destroy (cb) {
    this.drive.off('append', this._bumpBound)
    this.drive.off('truncate', this._bumpBound)
    cb(null)
  }

  async _bump () {
    try {
      const length = this.drive.core.length
      const fork = this.drive.core.fork
      const node = await this.drive.db.get('release', { update: false })
      if (this.destroying) return

      if (node) {
        const release = node.value || 0
        if (release <= this._checkout) return
        this.push({ key: this.drive.key, length: release, fork })
        return
      }

      if (length <= this._checkout) return
      this.push({ key: this.drive.key, length, fork })
    } catch (err) {
      safetyCatch(err)
    }
  }
}
