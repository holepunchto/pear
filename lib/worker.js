'use strict'
const { isElectronRenderer, isWindows, isBare } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { command } = require('paparam')
const Pipe = isBare
  ? require('bare-pipe')
  : class Pipe extends require('net').Socket { constructor (fd) { super({ fd }) } }
const constants = require('../constants')
const rundef = require('../run/definition')
const noop = Function.prototype
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
    let parentLink = null
    let restIndex = null 
    const parser = command('run', ...rundef, (cmd) => {
      parentLink = cmd.args.link
      restIndex = cmd.indices.restIndex
    })
    const argv = program.argv.slice(1)
    parser.parse(argv)
    const args = argv.map((arg) => arg === parentLink ? link : arg)
    if (restIndex > 0) args.splice(restIndex)
    const sp = spawn(constants.RUNTIME, args, {
      stdio: ['inherit', 'inherit', 'inherit', 'overlapped'],
      windowsHide: true
    })
    this.#ref()
    sp.once('exit', (exitCode) => {
      if (exitCode !== 0) pipe.emit('crash', { exitCode })
      this.#unref()
    })
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
    pipe.once('close', () => {
      // allow close event to propagate between processes before exiting:
      setImmediate(() => program.exit())
    })
    return pipe
  }
}

module.exports = Worker
