const cmd = require('./cmd')
const connect = require('./lib/connect.js')

module.exports = async function cli () {
  const channel = await connect()
  await cmd(channel)
}
