'use strict'

let ipc = null

function setIPC(next) {
  ipc = next
}

function getIPC() {
  return ipc
}

module.exports = {
  setIPC,
  getIPC
}
