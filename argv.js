'use strict'

function normalizeBareArgv(argv = global.Bare?.argv) {
  if (!Array.isArray(argv) || argv.length < 2) return argv
  const arg1 = argv[1]
  if (typeof arg1 !== 'string') return argv
  if (!isInternalEntry(arg1)) return argv
  argv.splice(1, 1)
  return argv
}

function userArgv(argv = global.Bare?.argv) {
  const normalized = normalizeBareArgv(argv)
  return Array.isArray(normalized) ? normalized.slice(1) : []
}

function isInternalEntry(s) {
  return /[\\/](boot\.js|standalone-entry\.js|\.pear-standalone-entry\.js)$/.test(s)
}

module.exports = {
  normalizeBareArgv,
  userArgv
}
