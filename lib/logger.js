'use strict'
const format = require('bare-format')
const saveLog = require('./save-log.js')

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

  constructor({ labels = [], level = 'info', all = false } = {}) {
    this.labels = new Set(parseLabels(labels))
    this.all = all
    this.logPath = null
    this.setLevel(level)
  }

  setLevel(level) {
    this.level = normalizeLevel(level)
  }

  log(level, label, ...args) {
    level = normalizeLevel(level)
    if (level === 'off') throw new Error('Cannot log at level: off')
    if (Array.isArray(label)) {
      for (const value of label) this.log(level, value, ...args)
      return
    }

    const line = format(new Date().toISOString(), names[level], `[ ${label} ]`, ...args).replace(
      /\u0000/g,
      ''
    )
    if (this.logPath) saveLog(this.logPath, line + '\n')
    if (levels[level] > levels[this.level]) return
    if (!this.all && !this.labels.has(label)) return
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

function parseLabels(labels) {
  if (typeof labels === 'string') labels = labels.split(',')
  return labels.map((label) => label.trim()).filter(Boolean)
}

module.exports = Logger
