'use strict'
const { isElectronRenderer, isWindows, isBare } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { command } = require('paparam')
const Pipe = isBare
  ? require('bare-pipe')
  : class Pipe extends require('net').Socket { constructor (fd) { super({ fd }) } }
const constants = require('../constants')
const rundef = require('../def/run')
const noop = Function.prototype
const program = global.Bare || global.process
const FramedStream = require('framed-stream')
const Bundle = require('bare-bundle')
const path = isBare ? require('bare-path') : require('path')
const b4a = require('b4a')

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

  #args (link) {
    const parser = command('pear', command('run', ...rundef))
    const argv = ['run', '--trusted', ...program.argv.slice(2)]
    const cmd = parser.parse(argv, { sync: true })
    const args = argv.map((arg) => arg === cmd.args.link ? link : arg)
    if (cmd.indices.rest > 0) args.splice(cmd.indices.rest)
    let linksIndex = cmd.indices.flags.links
    const linksElements = linksIndex > 0 ? (cmd.flags.links === args[linksIndex]) ? 2 : 1 : 0
    if (cmd.indices.flags.startId > 0) {
      args.splice(cmd.indices.flags.startId, 1)
      if (linksIndex > cmd.indices.flags.startId) linksIndex -= linksElements
    }
    if (linksIndex > 0) args.splice(linksIndex, linksElements)
    return args
  }

  run (link, args = [], opts = { parseArgs: true }) {
    if (isElectronRenderer) return this.#ipc.workerRun(link)
    const stdio = Array.isArray(opts.stdio) ? opts.stdio.slice(0, 3) : ['inherit', 'inherit', 'inherit', 'overlapped']
    if (opts.parseArgs) args = [...this.#args(link), ...args]
    const sp = spawn(constants.RUNTIME, args, {
      stdio,
      windowsHide: true
    })
    this.#ref()
    sp.once('exit', (exitCode) => {
      if (exitCode !== 0) pipe.emit('crash', { exitCode })
      this.#unref()
    })
    const pipe = opts.stdio ? sp.stdio[1] : sp.stdio[3]
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

  _unref () {
    this.#unref()
  }
}

class TransformWorker extends Worker {
  worker = null
  stream = null
  spindownt = null
  running = null
  tasks = 0
  constructor (app) {
    super()
    this.app = app
    this.spindownms = 5000
    this.tasks = 0
    this.running = Promise.resolve()
  }

  run (link) {
    const pipe = super.run(link, ['run', link], { parseArgs: false })
    this.stream = new FramedStream(pipe)
    this.#spindownCountdown()
  }

  close () {
    this.running = null
    this.stream.end()
    this._unref()
  }

  #spindownCountdown () {
    clearTimeout(this.spindownt)
    this.spindownt = setTimeout(() => {
      if (this.tasks === 0) {
        return this.close()
      }
      this.#spindownCountdown()
    }, this.spindownms)
  }

  async transform (transforms, buffer) {
    if (transforms.length === 0) return buffer
    this.tasks++

    const stream = this.stream
    stream.write(b4a.from(JSON.stringify(transforms)))

    for (const transform of transforms) {
      const { name: transformName } = typeof transform === 'string' ? { name: transform } : transform
      let normalizedPath = path.normalize(transformName)
      const hasExtension = path.extname(normalizedPath) !== ''
      if (!hasExtension) normalizedPath = path.join('node_modules', normalizedPath)

      const bundle = await this.#bundle(normalizedPath)
      stream.write(bundle)
    }

    stream.write(buffer)

    const transformedBuffer = await new Promise((resolve) => {
      stream.once('data', (data) => {
        resolve(data)
        this.tasks--
      })
    })

    return transformedBuffer
  }

  async #bundle (path) {
    const b = new Bundle()
    const res = {}
    const { entrypoint, resolutions, sources } = await this.app.bundle.bundle(path)

    for (const [key, map] of Object.entries(resolutions)) {
      res[key] = map
    }

    for (const [key, source] of Object.entries(sources)) {
      b.write(key, source)
    }

    b.main = entrypoint
    b.resolutions = res

    return b.toBuffer()
  }
}

module.exports = Worker
module.exports.TransformWorker = TransformWorker
