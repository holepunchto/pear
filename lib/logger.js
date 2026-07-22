'use strict'
const format = require('bare-format')
const fileLogger = require('./file-logger.js')

const levels = { off: 0, error: 1, info: 2, trace: 3 }
const aliases = {
  0: 'off',
  OFF: 'off',
  1: 'error',
  ERR: 'error',
  ERROR: 'error',
  2: 'info',
  INF: 'info',
  INFO: 'info',
  3: 'trace',
  TRC: 'trace',
  TRACE: 'trace'
}
const names = { error: 'ERR', info: 'INF', trace: 'TRC' }
const outputs = { error: 'error', info: 'log', trace: 'error' }

class Logger {
  static levels = levels

  constructor({ level = 'info' } = {}) {
    this.logPath = null
    this.setLevel(level)
  }

  setLevel(level) {
    this.level = normalizeLevel(level)
  }

  log(level, label, ...args) {
    level = normalizeLevel(level)
    if (level === 'off') return
    const line = format(new Date().toISOString(), names[level], `[ ${label} ]`, ...args).replace(
      /\u0000/g,
      ''
    )
    if (levels[level] > levels[this.level]) return
    if (this.logPath) fileLogger(this.logPath).append(names[level], `[ ${label} ]`, ...args)
    console[outputs[level]](line)
  }

  error(label, ...args) {
    this.log('error', label, ...args)
  }

  info(label, ...args) {
    this.log('info', label, ...args)
  }

  trace(label, ...args) {
    this.log('trace', label, ...args)
  }

  setLogPath(logPath) {
    this.logPath = logPath
  }
}

function normalizeLevel(level) {
  const normalized = aliases[String(level).toUpperCase()]
  if (!normalized) throw new Error(`Unknown log level: ${level}`)
  return normalized
}

module.exports = Logger
