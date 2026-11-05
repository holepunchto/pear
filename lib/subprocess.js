'use strict'

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      resolve(signal ? 128 + signal : code)
    })
    child.on('error', reject)
  })
}

module.exports = {
  waitForExit
}
