console.log('Welcome to pear there are your options:')
console.log()
console.log('  --boot-sidecar, runs the sidecar')
console.log('  --boot-terminal, runs the terminal')
console.log()

const connect = require('./lib/connect.js')

test()

async function test () {
  const channel = await connect()
  const res = await channel.request('info')

  console.log(res)
  channel.close()
}
