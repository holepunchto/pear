'use strict'
const { Readable } = require('streamx')

class DriveMonitor extends Readable {
  constructor (drive, options = {}) {
    super({ ...options, objectMode: true })
    this.drive = drive
    this.speedometers = { download: new Speedometer(), upload: new Speedometer() }
    this.peers = 0
    this.download = { total: 0, speed: 0 }
    this.upload = { total: 0, speed: 0 }
    this.interval = null
    this.drive.getBlobs().then((blobs) => {
      blobs.core.on('download', (_index, bytes) => {
        this.download.total += bytes
        this.download.speed = this.speedometers.download.reading(bytes)
      })
      blobs.core.on('upload', (_index, bytes) => {
        this.uploadedBytes += bytes
        this.upload.speed = this.speedometers.upload.reading(bytes)
      })
      blobs.core.on('peer-add', () => {
        this.peers = blobs.core.peers.length
      })
      blobs.core.on('peer-remove', () => {
        this.peers = blobs.core.peers.length
      })

      this.interval = setInterval(() => {
        this.download.speed = this.speedometers.download.reading()
        this.upload.speed = this.speedometers.upload.reading()
        if (this.download.speed + this.upload.speed === 0) return
        this.push({
          peers: this.peers,
          download: {
            total: this.download.total,
            speed: this.download.speed
          },
          upload: {
            total: this.upload.total,
            speed: this.upload.speed
          }
        })
      }, 500)

      this.interval.unref()
    }).catch((err) => this.destroy(err))
  }

  _destroy () {
    clearInterval(this.interval)
    this.speedometers.download.destroy()
    this.speedometers.upload.destroy()
  }
}

class Speedometer {
  constructor (seconds = 5, resolution = 4) {
    this.tick = 1
    this.maxTick = 65535
    this.resolution = resolution
    this.buffer = [0]
    this.pointer = 1
    this.last = (this.tick - 1) & this.maxTick
    this.size = this.resolution * seconds
    this.interval = setInterval(() => {
      this.tick = (this.tick + 1) & this.maxTick
    }, (1000 / this.resolution) | 0)
    this.interval.unref()
  }

  reading (delta) {
    let dist = (this.tick - this.last) & this.maxTick
    if (dist > this.size) dist = this.size
    this.last = this.tick

    while (dist--) {
      if (this.pointer === this.size) this.pointer = 0
      this.buffer[this.pointer] = this.buffer[this.pointer === 0 ? this.size - 1 : this.pointer - 1]
      this.pointer++
    }

    if (delta) this.buffer[this.pointer - 1] += delta

    const top = this.buffer[this.pointer - 1]
    const btm = this.buffer.length < this.size ? 0 : this.buffer[this.pointer === this.size ? 0 : this.pointer]

    return this.buffer.length < this.resolution ? top : (top - btm) * this.resolution / this.buffer.length
  }

  destroy () {
    clearInterval(this.interval)
  }
}

module.exports = DriveMonitor
