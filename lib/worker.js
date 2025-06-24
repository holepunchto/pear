'use strict'
const { isElectronRenderer, isWindows, isBare } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const teardown = isBare ? require('./teardown') : (fn) => fn()
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { command } = require('paparam')
const Pipe = isBare
  ? require('bare-pipe')
  : class Pipe extends require('net').Socket { constructor (fd) { super({ fd }) } }
const constants = require('../constants')
const rundef = require('../def/run')
const shell = require('../shell')
const pearLink = require('pear-link')(constants.ALIASES)
const hypercoreid = require('hypercore-id-encoding')
const b4a = require('b4a')
const noop = Function.prototype
const program = global.Bare || global.process

class Worker {
  #pipe = null
  #ref = null
  #unref = null
  #ipc = null
  #parent = null
  #applink = null
  #length = null
  #fork = null
  static RUNTIME = constants.RUNTIME
  constructor ({ ref = noop, unref = noop, ipc = null, parent = null, applink = null, length = null, fork = null } = {}) {
    this.#ref = ref
    this.#unref = unref
    this.#ipc = ipc
    this.#parent = parent
    this.#applink = applink
    this.#length = length
    this.#fork = fork
  }

  #args (link) {
    const parser = command('pear', command('run', ...rundef))
    const sliced = program.argv.slice(1)
    const cmdIdx = shell(sliced).indices.args.cmd
    const argv = ['run', ...sliced.slice(cmdIdx + 1)]
    const cmd = parser.parse(argv)
    const args = argv.map((arg) => arg === cmd.args.link ? link : arg)
    if (cmd.indices.rest > 0) args.splice(cmd.indices.rest)
    let linksIndex = cmd.indices.flags.links
    const linksElements = linksIndex > 0 ? (cmd.flags.links === args[linksIndex]) ? 2 : 1 : 0
    if (cmd.indices.flags.startId > 0) {
      args.splice(cmd.indices.flags.startId, 1)
      if (linksIndex > cmd.indices.flags.startId) linksIndex -= linksElements
    }
    if (linksIndex > 0) args.splice(linksIndex, linksElements)
    if (!cmd.flags.trusted) args.splice(1, 0, '--trusted')
    if (this.#parent) args.splice(1, 0, '--parent', this.#parent)
    return args
  }

  run (link, args = []) {
    const { key: workerKey, fork: workerFork, length: workerLength } = pearLink(link).drive
    const { key: appKey } = (pearLink(this.#applink || Pear.config.applink)).drive
    if (appKey && b4a.equals(workerKey, appKey) && !workerFork && !workerLength) {
      const { pathname } = (pearLink(link))
      link = `pear://${this.#fork || Pear.config.fork}.${this.#length || Pear.config.length}.${hypercoreid.encode(workerKey)}${pathname || ''}`
    }
    if (isElectronRenderer) return this.#ipc.workerRun(link, args)
    args = [...this.#args(link), ...args]
    const sp = spawn(this.constructor.RUNTIME, args, {
      stdio: ['inherit', 'inherit', 'inherit', 'overlapped'],
      windowsHide: true
    })
    this.#ref()
    sp.once('exit', (exitCode) => {
      if (exitCode !== 0) pipe.emit('crash', { exitCode })
      this.#unref()
    })
    const pipe = sp.stdio[3]
    pipe.on('end', () => pipe.end())
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
    pipe.on('end', () => {
      teardown(() => pipe.end(), Number.MAX_SAFE_INTEGER)
    })
    this.#pipe = pipe
    pipe.once('close', () => {
      teardown(() => program.exit(), Number.MAX_SAFE_INTEGER)
    })
    return pipe
  }
}

module.exports = Worker
