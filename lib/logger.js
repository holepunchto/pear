'use strict'
const fs = require('bare-fs')
const format = require('bare-format')
const FileLog = require('bare-file-logger')

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

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

  constructor(logPath, { level = 'info' } = {}) {
    this.setLevel(level)
    this.fileLogger = new FileLog(logPath, { maxSize: MAX_SIZE, rotate })
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
    this.fileLogger.append(names[level], `[ ${label} ]`, ...args)
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
}

function normalizeLevel(level) {
  const normalized = aliases[String(level).toUpperCase()]
  if (!normalized) throw new Error(`Unknown log level: ${level}`)
  return normalized
}

function rotate(logPath) {
  const old = logPath.endsWith('.log') ? logPath.slice(0, -4) + '.old.log' : logPath + '.old'
  if (fs.existsSync(old)) fs.unlinkSync(old)
  return old
}

module.exports = Logger
