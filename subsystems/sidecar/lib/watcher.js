const safetyCatch = require('safety-catch')
const debounceify = require('debounceify')
const Localwatch = require('localwatch')
const { Readable } = require('streamx')

module.exports = function (checkout, drive, opts) {
  if (drive.key) return new Watcher(checkout, drive, opts)
  return new Localwatch(drive.root, {
    mapReadable() {
      return { key: null, length: 0, fork: 0 }
    }
  })
}

class Watcher extends Readable {
  constructor(checkout, drive, { releases } = {}) {
    super()

    this.drive = drive
    this._releases = releases
    this._bumpBound = debounceify(this._bump.bind(this))
    this._checkout = checkout

    this.drive.core.on('append', this._bumpBound)
    this.drive.core.on('truncate', this._bumpBound)
  }

  _destroy(cb) {
    this.drive.core.off('append', this._bumpBound)
    this.drive.core.off('truncate', this._bumpBound)
    cb(null)
  }

  async _bump() {
    try {
      const length = this.drive.core.length
      const fork = this.drive.core.fork
      const node = this._releases ? await this.drive.db.get('release', { update: false }) : null
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
