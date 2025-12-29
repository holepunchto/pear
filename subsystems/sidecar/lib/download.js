const ReadyResource = require('ready-resource')

class DownloadMonitor extends ReadyResource {
  constructor(prefetch, pod, intervalMs = 1000) {
    super()
    this._prefetch = prefetch
    this._downloaded = 0
    this._interval = null
    this._intervalMs = intervalMs
    this._pod = pod
    this._mirrors = []
  }

  start() {
    this._interval = setInterval(() => {
      const downloaded =
        this._downloaded +
        this._mirrors.reduce((acc, e) => acc + e.downloadedBlocks, 0)
      const estimated =
        this._estimate +
        this._mirrors.reduce((acc, e) => acc + e.downloadedBlocksEstimate, 0)
      this.emit('update', Math.min(downloaded / estimated, 0.99))
    }, this._intervalMs)
  }

  async _open() {
    const dbKey = this._pod.drive.db.core.id
    this._estimate = this._prefetch.downloads.reduce((acc, dl) => {
      // count only blob blocks
      if (dl.session.id === dbKey) {
        return acc
      } else {
        return acc + (dl.range.end - dl.range.start)
      }
    }, 0)
    this._pod.drive.blobs.core.on('download', () => this._downloaded++)
  }

  async _close() {
    clearInterval(this._interval)
  }

  addMirror(mirror) {
    this._mirrors.push(mirror)
  }
}

module.exports = DownloadMonitor
