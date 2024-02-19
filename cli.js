'use strict'
const cmd = require('./cmd')
const connect = require('./lib/connect.js')
const crasher = require('./lib/crasher')
const { SWAP } = require('./lib/constants.js')
crasher('cli', SWAP)

cli()

async function cli () {
  const channel = await connect()
  await cmd(channel)
}
