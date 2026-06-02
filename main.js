'use strict'
const path = require('bare-path')
const os = require('bare-os')
const { platform, arch, isWindows } = require('which-runtime')
const { init } = require('./constants.js')

const executable = resolveExecutable()
const devRoot = resolveDevRoot(executable)

module.exports = (channel) => {
  init(channel, true, devRoot)
  require('./boot.js')
}

function resolveExecutable() {
  const executable = os.execPath()
  if (!executable) {
    throw new Error('Unable to resolve runtime executable from execPath')
  }
  return executable
}

function resolveDevRoot(resolvedExecutable) {
  if (!resolvedExecutable) return null
  try {
    const host = `${platform}-${arch}`
    const file = isWindows ? 'pear.exe' : 'pear'
    const suffix = normalize(path.join('by-arch', host, 'bin', file))
    const exe = normalize(resolvedExecutable)
    if (!exe.endsWith(suffix)) return null
    const trim = exe.length - suffix.length
    const root = trim > 0 ? exe.slice(0, trim).replace(/\/+$/, '') : ''
    return root || '/'
  } catch {
    return null
  }
}

function normalize(p) {
  return p.replace(/\\/g, '/')
}
