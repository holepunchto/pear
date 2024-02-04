const connect = require('./lib/connect')

boot()

async function boot () {
  const channel = await connect()

  const res = await channel.request('info')

  console.log(res)

  channel.close()
}
