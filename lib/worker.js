'use strict'
const noop = Function.prototype
const { isElectronRenderer } = require('which-runtime')
const fs = global.Bare ? require('bare-fs') : require('fs')
const { spawn } = global.Bare ? require('bare-subprocess') : require('child_process')
const Pipe = global.Bare
  ? require('bare-pipe')
  : class Pipe extends require('net').Socket { constructor (fd) { super({ fd }) } }
const constants = require('./constants')
const program = global.Bare || global.process

class Worker {
  #pipe = null
  #ref = null
  #unref = null
  constructor ({ ref = noop, unref = noop, ipc = null } = {}) {
    this.#ref = ref
    this.#unref = unref
    this.ipc = ipc
  }

  run (link) {
    if (isElectronRenderer) return this.ipc.workerRun(link)
    const sp = spawn(constants.RUNTIME, ['run', link], {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe']
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
      if (fs.fstatSync(fd).isSocket() === false) return null
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
