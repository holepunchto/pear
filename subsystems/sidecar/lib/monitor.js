'use strict'
const EventEmitter = require('events')

class Monitor extends EventEmitter {
  static timer = null
  static monitors = new Set()
  static stats(mirror) {
    // NOTE: immutable (append-only) data structure for appling
    return {
      peers: mirror.peers.length,
      download: {
        bytes: mirror.downloadedBytes,
        blocks: mirror.downloadedBlocks,
        speed: mirror.downloadSpeed(),
        progress: mirror.downloadProgress
      },
      upload: {
        bytes: mirror.uploadedBytes,
        blocks: mirror.uploadedBlocks,
        speed: mirror.uploadSpeed()
      }
    }
  }
  static sweep() {
    for (const monitor of this.monitors) {
      monitor.emit('stats', this.stats(monitor.mirror))
    }
  }
  constructor(mirror) {
    super()
    if (!this.constructor.timer) {
      this.constructor.timer = setInterval(() => this.constructor.sweep(), 250)
      this.constructor.timer.unref()
    }
    this.mirror = mirror
    this.fn = null
    this.constructor.monitors.add(this)
  }
  stop() {
    this.constructor.monitors.delete(this)
  }
}

module.exports = Monitor
