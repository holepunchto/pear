'use strict'
const { isBare } = require('which-runtime')
const hrtime = isBare ? require('bare-hrtime') : process.hrtime

class Logger {
  constructor ({ labels, levels, fields = '', stacks = false, level = 1 } = {}) {
    this._labels = new Set(this._parseLabels(labels))
    this._labels.add('internal-error')
    this._levels = levels
    this._level = this._parseLevel(level)
    this._times = {}
    this._show = this._parseFields(fields)
    this._stacks = stacks
    this.name = ''
    this.stack = ''
  }

  _args (level, label, ...args) {
    const now = hrtime.bigint()
    const ms = Number(now) / 1e6
    const delta = (this._times[label] ? '+' + (ms - Number(this._times[label]) / 1e6) + 'ms' : '+0ms')
    this._times[label] = now
    const datetime = (this._show.date || this._show.time) ? new Date().toISOString().split('T') : []
    const date = this._show.date ? datetime[0] : ''
    const time = this._show.time ? datetime[1].slice(0, -1) : ''
    label = this._show.label ? '[ ' + label + ' ]' : ''
    level = this._show.level ? level : ''
    return [level, date, time, label, ...args, this._show.delta ? delta : ''].filter(Boolean)
  }

  error (label, ...args) {
    if (this._level < 1 || !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.error)
    args = this._args('ERR', label, ...args)
    if (this._stacks) {
      console.error(...args, this.stack)
      this.stack = ''
    } else {
      console.error(...args)
    }
  }

  info (label, ...args) {
    if (this._level < 2 || !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.info)
    args = this._args('INF', label, ...args)
    if (this._stacks) {
      console.log(...args, this.stack)
      this.stack = ''
    } else {
      console.log(...args)
    }
  }

  trace (label, ...args) {
    if (this._level < 3 || !this._labels.has(label)) return
    if (this._stacks) Error.captureStackTrace(this, this.trace)
    args = this._args('TRC', label, ...args)
    if (this._stacks) {
      console.error(...args, this.stack)
      this.stack = ''
    } else {
      console.error(...args)
    }
  }

  _parseLevel (level) {
    if (typeof level !== 'string') return level
    level = level.toUpperCase()
    if (level === 'OFF' || level === '0') return 0
    if (level === 'INF' || level === 'INFO' || level === '1') return 1
    if (level === 'TRC' || level === 'TRACE' || level === 'TRA' || level === '2') return 2
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
    for (let field of fields.split(',')) {
      field = field.trim()
      if (field.startsWith('h:')) show[field.slice(2)] = false
      else show[field] = true
    }
    return show
  }

  _parseLabels (labels) {
    if (typeof labels !== 'string') return labels
    return labels.split(',')
  }
}

module.exports = Logger
