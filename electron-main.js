'use strict'
const IPC = require('./ipc/main')
const Context = require('./ctx/shared')
const { App } = require('./lib/gui')
const { SWAP } = require('./lib/constants')
const crasher = require('./lib/crasher')

const connect = require('./lib/connect.js')

electronMain().catch(console.error)

async function electronMain () {
  const channel = await connect()
  crasher('electron-main', SWAP)
  const ctx = new Context({
    argv: (process.argv.length > 1 && process.argv[1][0] === '-')
      ? process.argv.slice(1)
      : process.argv.slice(2)
  })
  process._rawDebug('a')
  if (ctx.error) {
    console.error(ctx.error)
    require('electron').app.quit(1)
    return
  }
  process._rawDebug('b')
  const client = channel
  process._rawDebug('c')
  const ipc = new IPC(ctx, client)
  process._rawDebug('d')
  if (await ipc.wakeup()) { // note: would be unhandled rejection on failure, but should never fail
    require('electron').app.quit(0)
    return
  }
  process._rawDebug('e')
  const app = new App(ctx)
  process._rawDebug('f')
  client.once('close', async () => { app.quit() })
  process._rawDebug('g')
  app.start(ipc).catch(console.error)
  process._rawDebug('h')
  await app.starting
  process._rawDebug('i')
  ipc.unloading().then(() => {
    app.close()
  }) // note: would be unhandled rejection on failure, but should never fail
  process._rawDebug('j')
}
