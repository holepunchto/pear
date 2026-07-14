'use strict'
const fs = require('bare-fs')
const path = require('bare-path')

const MAX_SIZE = 10 * 1024 * 1024

function saveLog(file, message, maxSize = MAX_SIZE) {
  fs.mkdirSync(path.dirname(file), { recursive: true })

  if (fs.existsSync(file) && fs.statSync(file).size + Buffer.byteLength(message) > maxSize) {
    const old = file.endsWith('.log') ? file.slice(0, -4) + '.old.log' : file + '.old'
    if (fs.existsSync(old)) fs.unlinkSync(old)
    fs.renameSync(file, old)
  }

  fs.appendFileSync(file, message)
}

module.exports = saveLog
