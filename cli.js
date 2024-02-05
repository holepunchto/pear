const minimist = require('minimist')
const connect = require('./lib/connect.js')
const run = require('./lib/run.js')

boot()

async function boot () {
  const args = minimist(Bare.argv)
  const channel = await connect()

  if (args._[1] === 'run' && args._[2]) return run(channel, args._[2])

  channel.close()

  console.log('Welcome to pear there are your options:')
  console.log()
  console.log('  --boot-sidecar, runs the sidecar')
  console.log('  --boot-terminal, runs the terminal')
  console.log()
}
