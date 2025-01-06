'use strict'
const { isBare } = require('which-runtime')
const { Writable } = require('streamx')

let Cls = null

if (isBare) {
  const tty = require('bare-tty')
  const Pipe = require('bare-pipe')

  Cls = class Stdio {
    drained = Writable.drained
    constructor () {
      this._in = null
      this._out = null
      this._err = null
      this.rawMode = false
    }

    get inAttached () { return this._in !== null }

    get in () {
      if (this._in === null) {
        this._in = tty.isTTY(0) ? new tty.ReadStream(0) : new Pipe(0)
        this._in.once('close', () => { this._in = null })
      }
      return this._in
    }

    get out () {
      if (this._out === null) {
        this._out = tty.isTTY(1) ? new tty.WriteStream(1) : new Pipe(1)
        // Ignore stdout if pipe fails to open
        if (this._out.readyState && this._out.readyState !== 'open') {
          this._out.destroy()
          this._out = new Writable()
        }
      }
      return this._out
    }

    get err () {
      if (this._err === null) {
        this._err = tty.isTTY(2) ? new tty.WriteStream(1) : new Pipe(2)
        // Ignore errors if pipe fails to open
        if (this._err.readyState && this._err.readyState !== 'open') {
          this._err.destroy()
          this._err = new Writable()
        }
      }
      return this._err
    }

    size () {
      if (!this.out.getWindowSize) return [80, 80]
      const [width, height] = this.out.getWindowSize()
      return { width, height }
    }

    raw (rawMode) {
      this.rawMode = !!rawMode
      return this.in.setMode(this.rawMode ? this.tty.constants.MODE_RAW : this.tty.constants.MODE_NORMAL)
    }
  }
} else {
  Cls = class Stdio {
    in = process.stdin
    out = process.stdout
    err = process.stderr
    rawMode = false
    drained = Writable.drained
    raw (rawMode) {
      this.rawMode = !!rawMode
      return this.in.setRawMode(this.rawMode)
    }

    size () { return { height: this.out.rows, width: this.out.columns } }
  }
}

module.exports = new Cls()
