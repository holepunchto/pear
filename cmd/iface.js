'use strict'
const { once } = require('bare-events')
const byteSize = require('tiny-byte-size')
const { IS_WINDOWS } = require('../lib/constants')
const stdio = require('../lib/stdio')
const ADD = 1
const REMOVE = -1
const CHANGE = 0
const rich = IS_WINDOWS === false && stdio.out.isTTY
const pt = (arg) => arg
const es = () => ''
const ansi = rich
  ? {

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
      link: (url, text = url) => `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`
    }
  : { bold: pt, dim: pt, italic: pt, underline: pt, inverse: pt, red: pt, green: pt, yellow: pt, gray: pt, upHome: es, link: pt }

const rx = /[\x1B\x9B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\x07)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g // eslint-disable-line no-control-regex

function status (msg, success) {
  msg = msg || ''
  const done = typeof success === 'boolean'
  if (msg) stdio.out.write(`${indicator(success)}${msg}\n${done ? '' : ansi.upHome()}`)
}

function print (message, success) {
  console.log(`${typeof success !== 'undefined' ? indicator(success) : ''}${message}`)
}

function byteDiff ({ type, sizes, message }) {
  sizes = sizes.map((size) => (size > 0 ? '+' : '') + byteSize(size)).join(', ')
  print(indicator(type, 'diff') + ' ' + message + ' (' + sizes + ')')
}

function diff ({ prefix = '', suffix = '', add, remove, change, success }) {
  status(prefix + indicator(ADD, 'diff') + add + ' ' + indicator(REMOVE, 'diff') + remove + ' ' + indicator(CHANGE, 'diff') + change + suffix, success)
}

function indicator (value, type = 'success') {
  if (value === true) value = 1
  else if (value === false) value = -1
  else if (value == null) value = 0
  if (type === 'diff') return value === 0 ? ansi.yellow('~') : (value === 1 ? ansi.green('+') : ansi.red('-'))
  return value < 0 ? ansi.red('✖ ') : (value > 0 ? ansi.green('✔ ') : ansi.gray('- '))
}

const outputter = (cmd, taggers = {}) => async (json, iterable, state = {}) => {
  try {
    for await (const { tag, data = {} } of iterable) {
      if (json) {
        print(JSON.stringify({ cmd, tag, data }))
        continue
      }
      if (tag === 'error') {
        const err = new Error(data.message)
        err.sidecarCode = data.code
        err.sidecarStack = data.stack
        throw err
      }
      let result = typeof taggers[tag] === 'function' ? taggers[tag](data, state) : (taggers[tag] || false)
      if (result === undefined) continue
      if (typeof result === 'string') result = { output: 'print', message: result }
      if (result === false) {
        if (tag === 'final') result = { output: 'print', message: data.success ? 'Success\n' : 'Failure\n' }
      }
      const { output, message, success = data.success } = result
      if (output === 'print') print(message, success)
      if (output === 'status') status(message, success)
      if (tag === 'diff') diff(data)
      if (tag === 'byte-diff') byteDiff(data)
    }
  } catch (err) {
    if (err.sidecarCode === 'ERR_BARE_CORE') print(err.message, -1)
    else console.error(err)
  }
}

class Interact {
  constructor (header, params, type) {
    this._header = header
    this._params = params
    this._type = type
    stdio.out.write('\n')
    stdio.out.write(this._header)
  }

  async run (opts = {}) {
    const fields = {}
    if (opts.autosubmit) return this._autosubmit()
    while (this._params.length) {
      const param = this._params.shift()
      if (await this._evaluate(param, fields, this._params)) {
        while (true) {
          let answer = await this._input(`${param.prompt}:${param.default && ' (' + param.default + ')'} `)
          if (answer.length === 0) answer = param.default
          if (!param.validation || await param.validation(answer)) {
            if (typeof answer === 'string') answer = answer.replace(rx, '')
            fields[param.name] = answer
            break
          } else {
            stdio.out.write(param.msg + '\n')
          }
        }
      } else {
        continue
      }
    }

    return { fields, result: this._getResult(fields) }
  }

  _autosubmit () {
    const fields = {}
    if (this._type) { // skip type
      this._params.shift()
      fields.type = this._type
    }
    while (this._params.length) {
      const param = this._params.shift()
      if (!param.type || param.type === this._type) fields[param.name] = param.default
    }
    return { fields, result: this._getResult(fields) }
  }

  async _input (prompt) {
    stdio.out.write(prompt)
    const answer = (await once(stdio.in, 'data')).toString()
    return answer.trim() // remove return char
  }

  _evaluate (param, fields) {
    if (this._type && param.name === 'type') { // skip type if given by arg
      fields.type = this._type
      return false
    }
    if (param.name === 'type') return true
    return !param.type || param.type === fields.type
  }

  _getResult (fields) {
    if (fields.type === 'desktop') {
      return this._getDesktopResult(fields)
    } else {
      return this._getTerminalResult(fields)
    }
  }

  _getDesktopResult (fields) {
    return {
      name: fields.name,
      main: fields.main,
      type: 'module',
      pear: {
        name: fields.name,
        type: fields.type,
        gui: {
          backgroundColor: '#1F2430',
          height: fields.height,
          width: fields.width
        }
      },
      license: fields.license,
      devDependencies: {
        brittle: '^3.0.0'
      }
    }
  }

  _getTerminalResult (fields) {
    return {
      name: fields.name,
      main: fields.main,
      type: 'module',
      pear: {
        name: fields.name,
        type: fields.type
      },
      license: fields.license,
      devDependencies: {
        brittle: '^3.0.0'
      }
    }
  }
}

const interact = (header, params, type) => {
  return new Interact(header, params, type)
}

class InputError extends Error {
  code = 'ERR_INPUT'
  constructor (message, { showUsage = true } = {}) {
    super(message)
    this.showUsage = showUsage
  }
}

class Loading {
  y = 0
  i = 0
  interval = null
  cleared = false
  started = Date.now()
  shape (opts) {
    return `\x1b[s\x1b[J\x1b[32m
           ▅
           ▀
        ▂▂▄▟▙▃
       ▄▄▄▄▆▆▆▆
      ▄▄▄▄▄▆▆▆▆▆
      ▄▄▄▄▄▆▆▆▆▆
     ▄▄▄▄▄▄▆▆▆▆▆▆${opts?.msg ? '         ' + opts.msg : ''}
    ▃▄▄▄▄▄▄▆▆▆▆▆▆▄
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆
     ▄▄▄▄▄▄▆▆▆▆▆▆
       ▄▄▄▄▆▆▆▆\n       \x1b[2mLᴏᴀᴅɪɴɢ…\x1b[u`
  }

  constructor (opts) {
    const shape = this.shape(opts)
    this.frames = ['░', shape, '▒', '░', shape, shape, shape, shape]
    this.ms = 1100 / this.frames.length
    stdio.raw(true)
    stdio.in.resume()
    stdio.in.once('data', (data) => {
      const match = data.toString().match(/\[(\d+);(\d+)R/)
      if (!match) return
      this.y = parseInt(match[1], 10)
      const { frames } = this
      const { height } = stdio.size()
      const lines = shape.split('\n')
      const available = height - this.y
      if (available < lines.length) {
        const offset = lines.length - available
        stdio.out.write(`\x1b[${offset}S`)
        stdio.out.write(`\x1b[${offset}F`)
      }
      stdio.out.write(shape)
      this.interval = setInterval(() => {
        stdio.out.write(frames[this.i] === shape ? shape : shape.replace(/[▂▃▄▅▆▀░▒▓▙▟]/g, frames[this.i]))
        this.i = (this.i + 1) % frames.length
      }, this.ms)
      stdio.raw(false)
      stdio.in.pause()
    })
    stdio.out.write('\x1b[6n')

    this.clearing = new Promise((resolve) => {
      this._cleared = resolve
    })
  }

  clear (force = false) {
    const timespan = Date.now() - this.started
    const fulltime = (this.ms * this.frames.length) * 3
    if (force === false && timespan < fulltime) {
      setTimeout(() => this.clear(), fulltime - timespan)
      return this.clearing
    } else {
      this.cleared = true
      clearInterval(this.interval)
      stdio.raw(false)
      stdio.in.pause()
      stdio.out.write('\x1b[u\x1b[J\x1b[0m')
      this._cleared()
      return this.clearing
    }
  }
}

module.exports = { stdio, ansi, indicator, status, print, byteDiff, diff, outputter, rich, interact, InputError, Loading }

/*
use ansi styles as needed by placing them in ansi object
  {
    reset: (s) => `\x1B[0m${s}\x1B[0m`,
    bold: (s) => `\x1B[1m${s}\x1B[22m`,
    dim: (s) => `\x1B[2m${s}\x1B[22m`,
    italic: (s) => `\x1B[3m${s}\x1B[23m`,
    underline: (s) => `\x1B[4m${s}\x1B[24m`,
    overline: (s) => `\x1B[53m${s}\x1B[55m`,
    inverse: (s) => `\x1B[7m${s}\x1B[27m`,
    hidden: (s) => `\x1B[8m${s}\x1B[28m`,
    strikethrough: (s) => `\x1B[9m${s}\x1B[29m`,
    black: (s) => `\x1B[30m${s}\x1B[39m`,
    red: (s) => `\x1B[31m${s}\x1B[39m`,
    green: (s) => `\x1B[32m${s}\x1B[39m`,
    yellow: (s) => `\x1B[33m${s}\x1B[39m`,
    blue: (s) => `\x1B[34m${s}\x1B[39m`,
    magenta: (s) => `\x1B[35m${s}\x1B[39m`,
    cyan: (s) => `\x1B[36m${s}\x1B[39m`,
    white: (s) => `\x1B[37m${s}\x1B[39m`,
    blackBright: (s) => `\x1B[90m${s}\x1B[39m`,
    redBright: (s) => `\x1B[91m${s}\x1B[39m`,
    greenBright: (s) => `\x1B[92m${s}\x1B[39m`,
    yellowBright: (s) => `\x1B[93m${s}\x1B[39m`,
    blueBright: (s) => `\x1B[94m${s}\x1B[39m`,
    magentaBright: (s) => `\x1B[95m${s}\x1B[39m`,
    cyanBright: (s) => `\x1B[96m${s}\x1B[39m`,
    whiteBright: (s) => `\x1B[97m${s}\x1B[39m`,
    bgBlack: (s) => `\x1B[40m${s}\x1B[49m`,
    bgRed: (s) => `\x1B[41m${s}\x1B[49m`,
    bgGreen: (s) => `\x1B[42m${s}\x1B[49m`,
    bgYellow: (s) => `\x1B[43m${s}\x1B[49m`,
    bgBlue: (s) => `\x1B[44m${s}\x1B[49m`,
    bgMagenta: (s) => `\x1B[45m${s}\x1B[49m`,
    bgCyan: (s) => `\x1B[46m${s}\x1B[49m`,
    bgWhite: (s) => `\x1B[47m${s}\x1B[49m`,
    bgBlackBright: (s) => `\x1B[100m${s}\x1B[49m`,
    bgRedBright: (s) => `\x1B[101m${s}\x1B[49m`,
    bgGreenBright: (s) => `\x1B[102m${s}\x1B[49m`,
    bgYellowBright: (s) => `\x1B[103m${s}\x1B[49m`,
    bgBlueBright: (s) => `\x1B[104m${s}\x1B[49m`,
    bgMagentaBright: (s) => `\x1B[105m${s}\x1B[49m`,
    bgCyanBright: (s) => `\x1B[106m${s}\x1B[49m`,
    bgWhiteBright: (s) => `\x1B[107m${s}\x1B[49m`,
    gray: (s) => `\x1B[90m${s}\x1B[39m`,
    bgGray: (s) => `\x1B[100m${s}\x1B[49m`,
    up: (n = 1) =>  `\x1B[${n}A`,
    down: (n = 1) =>  `\x1B[${n}B`,
    left: (n = 1) =>  `\x1B[${n}C`,
    right: (n = 1) =>  `\x1B[${n}D`,
    downHome: (n = 1) =>  `\x1B[${n}E`,
    upHome: (n = 1) =>  `\x1B[${n}F`,
  }

*/
