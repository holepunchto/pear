'use strict'
const { once } = require('bare-events')
const byteSize = require('tiny-byte-size')
const esc = require('bare-ansi-escapes')
const KeyDecoder = require('bare-ansi-escapes/key-decoder')
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
  constructor (desktopTemplate, terminalTemplate, desktopParams, terminalParams, header) {
    this._index = 0
    this._origin = null
    this._desktopParams = this._preprocessParams(desktopTemplate, desktopParams)
    this._terminalParams = this._preprocessParams(terminalTemplate, terminalParams)
    this._desktopTemplate = desktopTemplate
    this._terminalTemplate = terminalTemplate
    this._header = header
    this._padding = 3
    this._templateLines = this._desktopTemplate.trim().split('\n').length
    this._type = null
  }

  get _params () {
    return this._type === 'desktop' ? this._desktopParams : this._terminalParams
  }

  async run (type, opts = {}) {
    this._type = type
    if (opts.autosubmit) {
      return { result: this._getResult().replace(rx, ''), fields: this._getFields() }
    }
    stdio.out.write(this._header)
    const cursorPosition = await this._cursorPosition()
    this._origin = cursorPosition
    const size = stdio.size().height
    this._limit = cursorPosition.y + this._header.split('\n').length + this._templateLines + this._padding > size

    this._render()

    if (this._limit) {
      this._origin.y = size - this._templateLines - this._padding
      this._render()
    }

    await new Promise((resolve) => {
      const keyDecoder = new KeyDecoder()
      stdio.in.on('data', (data) => keyDecoder.write(data))
      keyDecoder.on('data', async (press) => {
        this._onkeypress(press, resolve)
      })
    })

    this._clear()
    return { result: this._getResult().replace(rx, ''), fields: this._getFields() }
  }

  _update () {
    stdio.out.write(esc.cursorPosition(this._origin.x, this._origin.y))
    this._clear()
  }

  async _onkeypress (press, resolve) {
    if (['up', 'down', 'left', 'right'].indexOf(press.name) !== -1) return
    if (press.name === 'tab') {
      this._ontab(press)
    } else if (press.name === 'c' && press.ctrl) {
      this._exit()
    } else if (press.name === 'return') {
      this._onreturn(resolve)
    } else if (press.name === 'space') {
      this._onspace()
    } else if (press.name === 'backspace') {
      this._onbackspace()
    } else {
      const name = this._params[this._index].name
      const value = [this._params[this._index].value, press.name].join('')
      this._updateParams(name, value)
      this._render()
    }
  }

  _ontab (press) {
    if (this._validate()) {
      if (this._params[this._index].name === 'type') {
        this._type = this._params[this._index].value || this._params[this._index].default
        this._update()
      }
      if (press.shift) {
        this._index = --this._index
        if (this._index < 0) this._index = this._params.length - 1
      } else {
        this._index = ++this._index % this._params.length
      }
    }
    this._render()
  }

  _onreturn (resolve) {
    if (this._validate()) resolve()
    else this._render()
  }

  _onbackspace () {
    if (this._params[this._index].value) {
      const name = this._params[this._index].name
      const value = this._params[this._index].value.slice(0, -1)
      this._updateParams(name, value)
      this._render()
    }
  }

  _onspace () {
    const name = this._params[this._index].name
    const value = [this._params[this._index].value, ' '].join('')
    this._updateParams(name, value)
    this._render()
  }

  _updateParams (name, value) {
    const desktopParam = this._desktopParams.find(p => p.name === name)
    const terminalParam = this._terminalParams.find(p => p.name === name)
    if (desktopParam) desktopParam.value = value
    if (terminalParam) terminalParam.value = value

    if (name === 'name') {
      const desktopParam = this._desktopParams.find(p => p.name === 'pear-name')
      const terminalParam = this._terminalParams.find(p => p.name === 'pear-name')
      if (desktopParam) desktopParam.value = value
      if (terminalParam) terminalParam.value = value
    }
    if (name === 'pear-name') {
      const desktopParam = this._desktopParams.find(p => p.name === 'name')
      const terminalParam = this._terminalParams.find(p => p.name === 'name')
      if (desktopParam) desktopParam.value = value
      if (terminalParam) terminalParam.value = value
    }
  }

  _render () {
    stdio.out.write(esc.cursorPosition(this._origin.x, this._origin.y))
    stdio.out.write('\x1b[s\x1b[J') // clear below
    stdio.out.write(this._getResult())
    if (this._error) {
      stdio.out.write('\n')
      stdio.out.write('\n')
      stdio.out.write('   ✖  ' + this._error)
    } else {
      stdio.out.write('\n') // this padding is needed in case of vertical limit, we need extra space for rendering the error and keep the origin point correct.
      stdio.out.write('\n')
      stdio.out.write('\n')
    }
    const x = this._origin.x + this._params[this._index].position.x + (this._params[this._index].value?.length || 0) - 2
    const y = this._origin.y + this._params[this._index].position.y
    stdio.out.write(esc.cursorPosition(x, y))
  }

  _clear () {
    stdio.out.write(esc.cursorPosition(this._origin.x, this._origin.y - 1))
    stdio.out.write('\x1b[s\x1b[J') // clear below
  }

  _exit () {
    stdio.out.write(esc.cursorPosition(0, this._origin.y + this._templateLines + 1))
    stdio.out.write('exiting [ ctrl^c ]\n')
    stdio.raw(false)
    stdio.drained(stdio.out).finally(() => Bare.exit(130))
  }

  _validate () {
    this._error = null
    if (!this._params[this._index].valid || !this._params[this._index].value) return true
    if (!this._params[this._index].valid(this._params[this._index].value)) {
      this._error = this._params[this._index].vmsg
      return false
    }
    return true
  }

  _getResult () {
    const template = this._type === 'desktop' ? this._desktopTemplate : this._terminalTemplate
    return this._params.reduce((template, e, i) => {
      return template.replaceAll('$' + e.name, ansi.dim(this._params[i].value || this._params[i].default))
    }, template).trim()
  }

  _getFields () {
    return this._params.reduce((acc, e) => {
      acc[e.name] = { value: (e.value || e.default) }
      return acc
    }, {})
  }

  _preprocessParams (template, params) {
    params.forEach((param, i) => {
      const position = template.trim().split('\n').reduce((acc, line, j) => {
        const x = line.indexOf('$' + param.name)
        if (x !== -1) {
          return { x, y: j }
        } else {
          return acc
        }
      }, {})
      params[i].position = position
    })
    return params
  }

  async _cursorPosition () {
    const readable = once(stdio.in, 'data')
    stdio.raw(true)
    stdio.in.resume()
    stdio.out.write('\x1B[6n')
    const [result] = await readable
    const [rows, cols] = result.slice(0, 7).slice(2, -1).toString().split(';')
    return { x: Number(cols) - 1, y: Number(rows) }
  }
}

const interact = (desktopTemplate, terminalTemplate, desktopParams, terminalParams, header) => {
  return new Interact(desktopTemplate, terminalTemplate, desktopParams, terminalParams, header)
}

class InputError extends Error { code = 'ERR_INPUT' }

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
