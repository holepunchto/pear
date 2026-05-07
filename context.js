'use strict'

const constants = require('pear-constants')

let ipc = null

function setIPC(next) {
  ipc = next
}

function getIPC() {
  return ipc
}

module.exports = {
  constants,
  setIPC,
  getIPC
}
