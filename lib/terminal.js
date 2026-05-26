'use strict'
const readline = require('bare-readline')
const tty = require('bare-tty')
const fs = require('bare-fs')
const os = require('bare-os')
const { Writable: BareWritable, Readable: BareReadable } = require('bare-stream')
const { Writable, Readable } = require('streamx')
const byteSize = require('tiny-byte-size')
const { isWindows } = require('which-runtime')
const gracedown = require('pear-gracedown')
const errors = require('pear-errors')
const opwait = require('pear-opwait')
const { UPGRADE, VERSION } = require('../constants.js')
const isTTY = tty.isTTY(0)

function ERR_SIGINT(msg) {
  return new errors(msg, ERR_SIGINT)
}

const pt = (arg) => arg
const es = () => ''
const ansi = isWindows
  ? {
      bold: pt,
      dim: pt,
      italic: pt,
      underline: pt,
      inverse: pt,
      red: pt,
      green: pt,
      yellow: pt,
      gray: pt,
      upHome: es,
      link: pt,
      hideCursor: es,
      showCursor: es
    }
  : {
      bold: (s) => `\x1B[1m${s}\x1B[22m`,
      dim: (s) => `\x1B[2m${s}\x1B[22m`,
      italic: (s) => `\x1B[3m${s}\x1B[23m`,
      underline: (s) => `\x1B[4m${s}\x1B[24m`,
      inverse: (s) => `\x1B[7m${s}\x1B[27m`,
      red: (s) => `\x1B[31m${s}\x1B[39m`,
      green: (s) => `\x1B[32m${s}\x1B[39m`,
      yellow: (s) => `\x1B[33m${s}\x1B[39m`,
      gray: (s) => `\x1B[90m${s}\x1B[39m`,
      upHome: (n = 1) => `\x1B[${n}F`,
      link: (url, text = url) => `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`,
      hideCursor: () => '\x1B[?25l',
      showCursor: () => '\x1B[?25h'
    }

ansi.sep = isWindows ? '-' : ansi.dim(ansi.green('∞'))
ansi.tick = isWindows ? '^' : ansi.green('✔')
ansi.cross = isWindows ? 'x' : ansi.red('✖')
ansi.warning = isWindows ? '!' : '⚠️'
ansi.pear = isWindows ? '*' : '🍐'
ansi.dot = isWindows ? 'o' : '•'
ansi.key = isWindows ? '>' : '🔑'
ansi.down = isWindows ? '↓' : '⬇'
ansi.up = isWindows ? '↑' : '⬆'

const stdio = new (class Stdio {
  static WriteStream = class FdWriteStream extends BareWritable {
    constructor(fd) {
      super({
        map: (data) => (typeof data === 'string' ? Buffer.from(data) : data)
      })
      this.fd = fd
    }

    _writev(batch, cb) {
      fs.writev(
        this.fd,
        batch.map(({ chunk }) => chunk),
        cb
      )
    }
  }

  static ReadStream = class FdReadStream extends BareReadable {
    constructor(fd) {
      super()
      this.fd = fd
    }

    _read(size) {
      const buffer = Buffer.alloc(size)
      fs.read(this.fd, buffer, 0, size, null, (err, bytesRead) => {
        if (err) return this.destroy(err)
        if (bytesRead === 0) return this.push(null)
        this.push(buffer.slice(0, bytesRead))
      })
    }
  }

  drained = Writable.drained
  constructor() {
    this._in = null
    this._out = null
    this._err = null
    this.rawMode = false
  }

  get inAttached() {
    return this._in !== null
  }

  get in() {
    if (this._in === null) {
      this._in = tty.isTTY(0) ? new tty.ReadStream(0) : new this.constructor.ReadStream(0)
      this._in.once('close', () => {
        this._in = null
      })
    }
    return this._in
  }

  get out() {
    if (this._out === null) {
      this._out = tty.isTTY(1) ? new tty.WriteStream(1) : new this.constructor.WriteStream(1)
    }
    return this._out
  }

  get err() {
    if (this._err === null) {
      this._err = tty.isTTY(2) ? new tty.WriteStream(2) : new this.constructor.WriteStream(2)
    }
    return this._err
  }

  size() {
    if (!this.out.getWindowSize) return [80, 80]
    const [width, height] = this.out.getWindowSize()
    return { width, height }
  }

  raw(rawMode) {
    this.rawMode = !!rawMode
    return this.in.setMode?.(
      this.rawMode ? this.tty.constants.MODE_RAW : this.tty.constants.MODE_NORMAL
    )
  }
})()

class Interact {
  static rx =
    /[\x1B\x9B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\x07)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g // eslint-disable-line no-control-regex
  constructor(header, params, opts = {}) {
    this._header = header
    this._params = params
    this._defaults = opts.defaults || {}

    const mask = (data, cb) => {
      if (data.length > 4) {
        // is full line
        const prompt = this._rl._prompt
        const regex = new RegExp(`(${prompt})([\\x20-\\x7E]+)`, 'g') // match printable chars after prompt
        const masked = data
          .toString()
          .replace(regex, (_, prompt, pwd) => prompt + '*'.repeat(pwd.length))
        stdio.out.write(masked)
      } else {
        stdio.out.write(data)
      }
      cb(null)
    }

    this._rl = readline.createInterface({
      input: stdio.in,
      output: opts.masked ? new Writable({ write: mask }) : stdio.out
    })
    this._rl.on('close', () => {
      console.log() // newline
    })
    stdio.in?.setMode?.(tty.constants.MODE_RAW)
  }

  async run(opts) {
    try {
      return await this.#run(opts)
    } finally {
      if (stdio.inAttached) stdio.in.destroy()
    }
  }

  async #run(opts = {}) {
    if (opts.autosubmit) return this.#autosubmit()
    stdio.out.write(this._header)
    const fields = {}
    const shave = {}
    const defaults = this._defaults
    while (this._params.length) {
      const param = this._params.shift()
      while (true) {
        const deflt = defaults[param.name] ?? param.default
        let answer = await this.#input(
          `${param.prompt}${param.delim || ':'}${deflt && ' (' + deflt + ')'} `
        )
        if (answer.length === 0) answer = defaults[param.name] ?? deflt
        if (!param.validation || (await param.validation(answer))) {
          if (typeof answer === 'string') answer = answer.replace(this.constructor.rx, '')
          fields[param.name] = answer
          if (Array.isArray(param.shave) && param.shave.every((ix) => typeof ix === 'number')) {
            shave[param.name] = param.shave
          }
          break
        } else {
          stdio.out.write(param.msg + '\n')
        }
      }
    }
    return { fields, shave }
  }

  #autosubmit() {
    const fields = {}
    const shave = {}
    const defaults = this._defaults
    while (this._params.length) {
      const param = this._params.shift()
      fields[param.name] = defaults[param.name] ?? param.default
      if (Array.isArray(param.shave) && param.shave.every((ix) => typeof ix === 'number')) {
        shave[param.name] = param.shave
      }
    }
    return { fields, shave }
  }

  async #input(prompt) {
    stdio.out.write(prompt)
    this._rl._prompt = prompt
    const answer = await new Promise((resolve, reject) => {
      this._rl.once('data', (data) => {
        resolve(data)
      })
      stdio.in?.once('data', (data) => {
        if (data.length === 1 && data[0] === 3) {
          reject(ERR_SIGINT('^C exit'))
          os.kill(Pear.pid, 'SIGINT')
        }
      })
    })
    return answer.toString().trim() // remove return char
  }
}

let statusFrag = ''

function status(msg, success) {
  msg = msg || ''
  const done = typeof success === 'boolean'
  if (msg) stdio.out.write(`\x1B[2K\r${indicator(success)}${msg}\n${done ? '' : ansi.upHome()}`)
  statusFrag = msg.slice(0, 3)
}

function print(message, success) {
  statusFrag = ''
  console.log(`${typeof success !== 'undefined' ? indicator(success) : ''}${message}`)
}

function byteDiff({ type, sizes, message }) {
  statusFrag = ''
  sizes = sizes.map((size) => (size > 0 ? '+' : '') + byteSize(size)).join(', ')
  print(indicator(type, 'diff') + ' ' + message + ' (' + sizes + ')')
}

function indicator(value, type = 'success') {
  if (value === undefined) return ''
  if (value === true) value = 1
  else if (value === false) value = -1
  else if (value === null) value = 0
  if (type === 'diff') {
    return value === 0 ? ansi.yellow('~') : value === 1 ? ansi.green('+') : ansi.red('-')
  }
  return value < 0
    ? ansi.cross + ' '
    : value === 1
      ? ansi.tick + ' '
      : value > 1
        ? ''
        : ansi.gray('- ')
}

const outputter =
  (cmd, taggers = {}) =>
  (opts, stream, info = {}, ipc) => {
    if (Array.isArray(stream)) stream = Readable.from(stream)
    const asTTY = opts.ctrlTTY ?? isTTY
    if (asTTY) stdio.out.write(ansi.hideCursor())
    const dereg = asTTY
      ? gracedown(() => {
          if (!isWindows) stdio.out.write('\x1B[1K\x1B[G' + statusFrag) // clear ^C
          stdio.out.write(ansi.showCursor())
        })
      : null
    if (typeof opts === 'boolean' || typeof opts === 'function') opts = { json: opts }
    const { json = false, log } = opts
    const promise = opwait(stream, ({ tag, data }) => {
      if (json) {
        const replacer = typeof json === 'function' ? json : null
        const str = JSON.stringify({ cmd, tag, data }, replacer)
        if (log) log(str)
        else print(str)
        return
      }

      const transform = Promise.resolve(
        typeof taggers[tag] === 'function' ? taggers[tag](data, info, ipc) : taggers[tag] || false
      )
      transform.then(
        (result) => {
          if (result === undefined) return
          if (typeof result === 'string') result = { output: 'print', message: result }
          if (result === false) {
            if (tag === 'final') {
              result = {
                output: 'print',
                message: (data.message ?? data.success) ? 'Success' : 'Failure'
              }
            } else result = {}
          }
          result.success = result.success ?? data?.success
          const { output, message, success = data?.success } = result
          if (log) {
            const logOpts = { output, ...(typeof success === 'boolean' ? { success } : {}) }
            if (Array.isArray(message) === false) log(message, logOpts)
            else for (const msg of message) log(msg, logOpts)
            return
          }
          let msg = Array.isArray(message) ? message.join('\n') : message
          if (tag === 'final') {
            if (!result.nonl) msg += '\n'
            if (asTTY) {
              stdio.out.write(ansi.showCursor())
              dereg(false)
            }
          }

          if (output === 'print') print(msg, success)
          else if (output === 'status') status(msg, success)
        },
        (err) => stream.destroy(err)
      )
    })

    return promise
  }

const banner = `${ansi.bold('Pear')} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
const version = `${UPGRADE} - ${VERSION}`
const header = `  ${banner}
  ${ansi.pear + ' '}${ansi.bold(ansi.gray(version))}
`
const urls =
  ansi.link('https://pears.com', 'pears.com') +
  ' | ' +
  ansi.link('https://holepunch.to', 'holepunch.to') +
  ' | ' +
  ansi.link('https://keet.io', 'keet.io')

const footer = {
  overview: `  ${ansi.bold('Legend:')} [arg] = optional, <arg> = required, | = or \n  Run ${ansi.bold('pear help')} to output full help for all commands\n  For command help: ${ansi.bold('pear help [cmd]')} or ${ansi.bold('pear [cmd] -h')}\n
${ansi.pear + ' '}\n${urls}\n${ansi.bold(ansi.dim('Pear'))} ~ ${ansi.dim('Welcome to the IoP')}`,
  help: `${ansi.pear + ' '}
${urls}\n${ansi.bold(ansi.dim('Pear'))} ~ ${ansi.dim('Welcome to the IoP')}
  `
}

const usage = { header, banner, footer }

function password(prompt = 'Password: ') {
  return new Promise((resolve) => {
    const stdin = new tty.ReadStream(0)
    const stdout = new tty.WriteStream(1)
    let str = ''

    stdin.setRawMode(true)
    stdout.write(prompt)

    stdin.on('data', (chunk) => {
      const c = chunk[0]
      if (c === 3) {
        stdout.write('^C\n')
        Bare.exit(130)
      } else if (c === 13 || c === 10) {
        stdin.setRawMode(false)
        stdin.destroy()
        stdout.write('\n')
        return resolve(str)
      } else if (c === 127 || c < 32) return
      str += String.fromCharCode(c)
      stdout.write('*')
    })
  })
}

module.exports = {
  usage,
  password,
  stdio,
  ansi,
  indicator,
  status,
  print,
  outputter,
  isTTY,
  byteSize,
  byteDiff,
  Interact
}
