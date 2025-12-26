const ReadyResource = require('ready-resource')

class DownloadMonitor extends ReadyResource {
  constructor (prefetch, pod, interval = 1000) {
    super()
    this._prefetch = prefetch
    this._downloaded = 0
    this._interval = null
    this._pod = pod
  }

  async _open() {
    this._estimate = this._prefetch.downloads.reduce((acc, dl) => {
      return acc + (dl.range.end - dl.range.start)
    }, 0)
    this._pod.drive.db.core.on('download', () => this._downloaded++)
    this._pod.drive.blobs.core.on('download', () => this._downloaded++)
    this._interval = setInterval(() => {
      console.log(`${this._downloaded} / ${this._estimate}`)
    }, 1000) // TODO change
  }
}

module.exports = DownloadMonitor
