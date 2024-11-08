'use strict'
const { isBare, isWindows } = require('which-runtime')
const hrtime = isBare ? require('bare-hrtime') : process.hrtime
const constants = require('../constants')

class Logger {
  static getLogger (flags) {
    return new Logger({
      level: flags.logLevel,
      labels: flags.logLabels,
      fields: flags.logFields,
      stacks: flags.logStacks,
      pretty: flags.log
    })
  }

  constructor ({ labels, fields, stacks = false, level, pretty = false } = {}) {
    labels = constants.PLATFORM_CHANNEL === 'prod' ? (labels ?? '') : 'run,sidecar,session'
    fields = constants.PLATFORM_CHANNEL === 'prod' ? (fields ?? '') : 'level,date,time,label,delta'
    level = constants.PLATFORM_CHANNEL === 'prod' ? (level ?? 1) : 'DEBUG'

    fields = this._parseFields(fields)
    this._labels = new Set(this._parseLabels(labels))
    this._labels.add('internal')
    this._show = fields.show
    this._stacks = stacks
    this._times = {}
    this.name = ''
    this.stack = ''
    this.LEVEL = this._parseLevel(level)
    this.CHECKMARK = isWindows ? '^' : '✔'
    if (pretty) {
      if (this.LEVEL < 3) this.LEVEL = 3
      if (this._labels.has('sidecar') === false) this._labels.add('sidecar')
      if (fields.seen.has('level') === false) this._show.level = false
      if (fields.seen.has('label') === false) this._show.label = this._labels.size > 2
    }
  }

  get OFF () { return this.LEVEL === 0 }
  get ERR () { return this.LEVEL === 1 }
  get WRN () { return this.LEVEL === 2 }
  get INF () { return this.LEVEL === 3 }
  get DBG () { return this.LEVEL === 4 }
  get TRC () { return this.LEVEL === 5 }

  _args (level, label, ...args) {
    const now = hrtime.bigint()
    const ms = Number(now) / 1e6
    const delta = this._times[label] ? ms - Number(this._times[label]) / 1e6 : 0
    this._times[label] = now
    const datetime = (this._show.date || this._show.time) ? new Date().toISOString().split('T') : []
    const date = this._show.date ? datetime[0] : ''
    const time = this._show.time ? datetime[1].slice(0, -1) : ''
    label = this._show.label ? '[ ' + label.slice(0, 14) + ' ]' : ''
    level = this._show.level ? level : ''
    const prefix = [level, date, time, label].filter(Boolean)
    return [...prefix, ...args, this._show.delta ? '[+' + (Math.round(delta * Math.pow(10, 4)) / Math.pow(10, 4)) + 'ms]' : '']
  }

  error (label, ...args) {
    if (this.LEVEL < 1) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.error(lbl, ...args)
      return
    }
    if (!this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.error)
    args = this._args('ERR', label, ...args)
    if (this._stacks) {
      console.error(...args, this.stack)
      this.stack = ''
    } else {
      console.error(...args)
    }
  }

  warn (label, ...args) {
    if (this.LEVEL < 2) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.warn(lbl, ...args)
      return
    }
    if (!this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.warn)
    args = this._args('WRN', label, ...args)
    if (this._stacks) {
      console.warn(...args, this.stack)
      this.stack = ''
    } else {
      console.warn(...args)
    }
  }

  info (label, ...args) {
    if (this.LEVEL < 3) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.info(lbl, ...args)
      return
    }
    if (!this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.info)
    args = this._args('INF', label, ...args)
    if (this._stacks) {
      console.info(...args, this.stack)
      this.stack = ''
    } else {
      console.info(...args)
    }
  }

  debug (label, ...args) {
    if (this.LEVEL < 4) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.debug(lbl, ...args)
      return
    }
    if (!this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.debug)
    args = this._args('DBG', label, ...args)
    if (this._stacks) {
      console.debug(...args, this.stack)
      this.stack = ''
    } else {
      console.debug(...args)
    }
  }

  trace (label, ...args) {
    if (this.LEVEL < 5) return
    if (Array.isArray(label)) {
      for (const lbl of label) this.trace(lbl, ...args)
      return
    }
    if (!this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.trace)
    args = this._args('TRC', label, ...args)
    if (this._stacks) {
      console.trace(...args, this.stack)
      this.stack = ''
    } else {
      console.trace(...args)
    }
  }

  _parseLevel (level) {
    if (typeof level === 'number') return level
    if (typeof level === 'string') level = level.toUpperCase()
    if (level === 'OFF' || level === '0') return 0
    if (level === 'ERR' || level === 'ERROR' || level === '1') return 1
    if (level === 'WRN' || level === 'WARN' || level === '2') return 2
    if (level === 'INF' || level === 'INFO' || level === '3') return 3
    if (level === 'DBG' || level === 'DEBUG' || level === '4') return 4
    if (level === 'TRC' || level === 'TRACE' || level === 'TRA' || level === '5') return 5
    return 1
  }

  _parseFields (fields) {
    const show = {
      date: false,
      time: false,
      level: true,
      label: true,
      delta: true
    }
    const seen = new Set()
    for (let field of fields.split(',')) {
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

  _parseLabels (labels) {
    if (typeof labels !== 'string') return labels
    return labels.split(',')
  }
}

module.exports = Logger
