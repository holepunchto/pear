'use strict'
const noop = Function.prototype
const { isElectronRenderer, isWindows, isBare } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const Pipe = isBare
  ? require('bare-pipe')
  : class Pipe extends require('net').Socket { constructor (fd) { super({ fd }) } }
const constants = require('./constants')
const program = global.Bare || global.process

class Worker {
  #pipe = null
  #ref = null
  #unref = null
  #ipc = null
  constructor ({ ref = noop, unref = noop, ipc = null } = {}) {
    this.#ref = ref
    this.#unref = unref
    this.#ipc = ipc
  }

  run (link) {
    if (isElectronRenderer) return this.#ipc.workerRun(link)
    const sp = spawn(constants.RUNTIME, ['run', link], {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
      windowsHide: true
    })
    this.#ref()
    sp.once('exit', () => this.#unref())
    const pipe = sp.stdio[3]
    return pipe
  }

  pipe () {
    if (this.#pipe) return this.#pipe
    const fd = 3
    try {
      const isWorker = isWindows ? fs.fstatSync(fd).isFIFO() : fs.fstatSync(fd).isSocket()
      if (isWorker === false) return null
    } catch {
      return null
    }
    const pipe = new Pipe(fd)
    this.#pipe = pipe
    pipe.once('close', () => { program.exit() })
    return pipe
  }
}

module.exports = Worker
