'use strict'
const { formatWithOptions } = require('bare-format')
const hrtime = require('bare-hrtime')
const persistLog = require('./persist-log.js')
const { cmdArgs } = require('../argv')
const pear = require('./cmd').command(cmdArgs)
const max = pear?.flags.logMax ?? false
const verbose = pear?.flags.logVerbose || max
const log = pear?.flags.log || !!pear?.flags.logLabels || verbose || max
const switches = {
  log,
  level: pear?.flags.logLevel ?? (max ? 3 : log ? 2 : 1),
  labels: pear?.flags.logLabels ?? '',
  fields: verbose ? 'date,time,level,label,delta' : (pear?.flags.logFields ?? ''),
  stacks: pear?.flags.logStacks ?? false,
  verbose,
  max
}

class Logger {
  static switches = switches
  static OFF = 0
  static ERR = 1
  static INF = 2
  static TRC = 3
  static [0] = 'OFF'
  static [1] = 'ERR'
  static [2] = 'INF'
  static [3] = 'TRC'
  name = '' // for stacks
  constructor({ labels = '', fields, stacks, level, pretty } = {}) {
    this._fields = this._parseFields(fields + this.constructor.switches.fields)
    labels = this._parseLabels(labels)
      .concat(this._parseLabels(this.constructor.switches.labels))
      .filter(Boolean)
    this._max = this.constructor.switches.max
    this._verbose = this.constructor.switches.verbose
    this._labels = new Set(labels)
    this._show = this._fields.show
    this._stacks = stacks ?? this.constructor.switches.stacks
    this._times = {}
    if (this._verbose === false && this._max === false && pretty) {
      if (this._fields.seen.has('level') === false) this._show.level = false
      if (this._fields.seen.has('label') === false) {
        this._show.label = this._labels.size > 2
      }
    }
    this.stack = ''
    this._errorLogPath = null
    this.LEVEL = this._parseLevel(level ?? this.constructor.switches.level)
    this._tty = null
  }

  get OFF() {
    return this.LEVEL === this.constructor.OFF
  }
  get ERR() {
    return this.LEVEL >= this.constructor.ERR
  }
  get INF() {
    return this.LEVEL >= this.constructor.INF
  }
  get TRC() {
    return this.LEVEL >= this.constructor.TRC
  }

  _args(level, label, ...args) {
    const now = hrtime.bigint()
    const ms = Number(now) / 1e6
    const delta = this._times[label] ? ms - Number(this._times[label]) / 1e6 : 0
    this._times[label] = now
    const datetime = this._show.date || this._show.time ? new Date().toISOString().split('T') : []
    const date = this._show.date ? datetime[0] : ''
    const time = this._show.time ? datetime[1].slice(0, -1) : ''
    label = this._show.label ? '[ ' + label.slice(0, 21) + ' ]' : ''
    level = this._show.level ? level : ''
    const prefix = [level, date, time, label].filter(Boolean)
    return [
      ...prefix,
      ...args,
      this._show.delta ? '[+' + Math.round(delta * Math.pow(10, 4)) / Math.pow(10, 4) + 'ms]' : ''
    ]
  }

  error(label, ...args) {
    if (Array.isArray(label)) {
      for (const lbl of label) this.error(lbl, ...args)
      return
    }
    if (this._errorLogPath) {
      const line = formatWithOptions({ colors: false }, 'ERR', `[ ${label} ]`, ...args).replace(
        /\u0000/g,
        ''
      )
      persistLog(this._errorLogPath, `${new Date().toISOString()} ${line}\n`)
    }
    if (this.LEVEL < this.constructor.ERR) return
    if (this._max === false && !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.error)
    args = this._args('ERR', label, ...args)
    if (this._stacks) {
      console.error(...args, this.stack)
      this.stack = ''
    } else {
      console.error(...args)
    }
  }

  info(label, ...args) {
    if (this.LEVEL < this.constructor.INF) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.info(lbl, ...args)
      return
    }
    if (this._max === false && !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.info)
    args = this._args('INF', label, ...args)
    if (this._stacks) {
      console.log(...args, this.stack)
      this.stack = ''
    } else {
      console.log(...args)
    }
  }

  trace(label, ...args) {
    if (this.LEVEL < this.constructor.TRC) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.trace(lbl, ...args)
      return
    }
    if (this._max === false && !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.trace)
    args = this._args('TRC', label, ...args)
    if (this._stacks) {
      console.error(...args, this.stack)
      this.stack = ''
    } else {
      console.error(...args)
    }
  }

  format(level, label, ...args) {
    if (this._tty === null) {
      this._tty = require('bare-tty').isTTY(0)
    } // lazy
    if (Object.hasOwn(this.constructor, level) === false) return ''
    if (typeof level === 'number') level = this.constructor[level]
    if (this.LEVEL < this.constructor[level]) return ''
    if (Array.isArray(label)) {
      return label.map((lbl) => this.format(level, lbl, ...args)).join('\n')
    }
    if (!this._labels.has(label)) return ''
    Error.captureStackTrace(this, this.format)
    args = this._args(level, label, ...args)
    if (this._stacks) {
      const output = formatWithOptions({ colors: this._tty }, ...args, this.stack).replace(
        /\u0000/g,
        ''
      ) // eslint-disable-line no-control-regex
      this.stack = ''
      return output
    } else {
      return formatWithOptions({ colors: this._tty }, ...args).replace(/\u0000/g, '') // eslint-disable-line no-control-regex
    }
  }

  _parseLevel(level) {
    if (typeof level === 'number') return level
    if (typeof level === 'string') level = level.toUpperCase()
    switch (true) {
      case level === 'OFF':
        return this.constructor.OFF
      case level === 'ERR':
        return this.constructor.ERR
      case level === 'INF':
        return this.constructor.INF
      case level === 'TRC':
        return this.constructor.TRC
      case level === '0':
        return this.constructor.OFF
      case level === '1':
        return this.constructor.ERR
      case level === '2':
        return this.constructor.INF
      case level === '3':
        return this.constructor.TRC
      case level === 'ERROR':
        return this.constructor.ERR
      case level === 'INFO':
        return this.constructor.INF
      case level === 'TRACE':
        return this.constructor.TRC
      default:
        return this.constructor.INF
    }
  }

  _parseFields(fields = '') {
    const show = {
      date: false,
      time: false,
      level: true,
      label: true,
      delta: true
    }
    const seen = new Set()
    for (let field of fields.split(',').concat(this.constructor.switches.fields.split(','))) {
      if (seen.has(field)) continue
      field = field.trim()
      if (field.startsWith('h:')) {
        field = field.slice(2)
        seen.add(field)
        show[field] = false
        continue
      }
      seen.add(field)
      show[field] = true
    }
    return { seen, show }
  }

  _parseLabels(labels) {
    if (typeof labels !== 'string') return labels
    return labels.split(',')
  }

  persistErrors(errorLogPath) {
    this._errorLogPath = errorLogPath
  }
}

module.exports = Logger
