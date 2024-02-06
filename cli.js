const cmd = require('./cmd')
const connect = require('./lib/connect.js')

cli()

async function cli () {
  const channel = await connect()
  await cmd(channel)
}
