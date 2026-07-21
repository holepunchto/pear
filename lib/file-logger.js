'use strict'
const FileLog = require('bare-file-logger')
const fs = require('bare-fs')
const path = require('bare-path')

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const logs = new Map()

function fileLogger(logPath) {
  if (logs.has(logPath)) return logs.get(logPath)

  fs.mkdirSync(path.dirname(logPath), { recursive: true })

  const log = new FileLog(logPath, { maxSize: MAX_SIZE, rotate })

  logs.set(logPath, log)
  return log
}

function rotate(logPath) {
  const old = logPath.endsWith('.log') ? logPath.slice(0, -4) + '.old.log' : logPath + '.old'
  if (fs.existsSync(old)) fs.unlinkSync(old)
  return old
}

module.exports = fileLogger
