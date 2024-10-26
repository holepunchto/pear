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

  run (link, args = []) {
    if (isElectronRenderer) return this.#ipc.workerRun(link, args)
    args = [...this.#args(link), ...args]
    const sp = spawn('/Users/dmc/.nvm/versions/node/v20.11.0/bin/bare', args, {
      stdio: ['inherit', 'inherit', 'pipe', 'overlapped'],
      windowsHide: true
    })
    sp.stderr.on('data', (data) => {
      console.error('STDERR', data + '')
    })
    this.#ref()
    sp.once('exit', (exitCode) => {
      if (exitCode !== 0) pipe.emit('crash', { exitCode })
      console.log('SP EXIT')
      pipe.end()
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
    pipe.on('end', () => pipe.end())
    this.#pipe = pipe
    pipe.once('close', () => {
      // allow close event to propagate between processes before exiting:
      setImmediate(() => program.exit())
    })
    return pipe
  }
}
const worker = new Worker()
const pipe = worker.pipe()

let i = 0
let interval = null
pipe.on('data', (data) => {
  const str = data.toString()
  if (str === 'ping') {
    interval = setInterval(() => pipe.write((i++).toString()), 2000)
  }
  if (str === 'exit') {
    clearInterval(interval)
    Bare.exit()
  }
})
