'use strict'

function normalizeBareArgv(argv = global.Bare?.argv) {
  if (!Array.isArray(argv) || argv.length < 2) return argv
  const arg1 = argv[1]
  if (typeof arg1 !== 'string') return argv
  if (!isMain(arg1)) return argv
  return argv.slice(1)
}

function isMain(s) {
  return /[\\/](boot\.js|main\.js)$/.test(s)
}

const normalizedArgv = normalizeBareArgv()
const cmdArgs = Array.isArray(normalizedArgv) ? normalizedArgv.slice(1) : []

module.exports = { normalizedArgv, cmdArgs }
