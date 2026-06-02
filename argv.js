'use strict'
const { LOCALDEV } = require('./constants.js')

function normalizeBareArgv(argv = global.Bare?.argv) {
  if (LOCALDEV) return argv.slice(1)
  return argv
}

const normalizedArgv = normalizeBareArgv()
const cmdArgs = Array.isArray(normalizedArgv) ? normalizedArgv.slice(1) : []

module.exports = { normalizedArgv, cmdArgs }
