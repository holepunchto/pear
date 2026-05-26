'use strict'

const constants = require('./constants.js')

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
