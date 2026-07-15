'use strict'
const fs = require('bare-fs')
const path = require('bare-path')

const MAX_SIZE = 10 * 1024 * 1024

function saveLog(logPath, message, maxSize = MAX_SIZE) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true })

  if (fs.existsSync(logPath) && fs.statSync(logPath).size + Buffer.byteLength(message) > maxSize) {
    const old = logPath.endsWith('.log') ? logPath.slice(0, -4) + '.old.log' : logPath + '.old'
    if (fs.existsSync(old)) fs.unlinkSync(old)
    fs.renameSync(logPath, old)
  }

  fs.appendFileSync(logPath, message)
}

module.exports = saveLog
