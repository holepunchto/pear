const { isBare } = require('which-runtime')
const fsp = isBare ? require('bare-fs/promises') : require('fs/promises')

module.exports = async (log) => {
  const pid = isBare ? Bare.pid : global.process.pid
  return fsp.appendFile('/tmp/pear-debug.log', `pid ${pid}: ${log}\n`)
}
