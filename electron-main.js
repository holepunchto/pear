'use strict'
const electron = require('electron')
const { isWindows, isMac, isLinux } = require('which-runtime')
const { command } = require('paparam')
const State = require('./state')
const GUI = require('./gui')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./constants')
const runDefinition = require('./def/run')
const argv = (process.argv.length > 1 && process.argv[1][0] === '-') ? process.argv.slice(1) : process.argv.slice(2)
const runix = argv.indexOf('--run')
if (runix > -1) argv.splice(runix, 1)

configureElectron()
crasher('electron-main', SWAP, argv.indexOf('--log') > -1)
const run = command('run', ...runDefinition, electronMain)
run.parse(argv)
run.running?.catch(console.error)

async function electronMain (cmd) {
  const state = new State({
    link: cmd.args.link.replace('_||', '://'), // for Windows
    flags: cmd.flags,
    args: cmd.rest
  })
  State.storage(state)

  if (state.error) {
    console.error(state.error)
    electron.app.quit(1)
    return
  }

  const gui = new GUI({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    tryboot,
    state
  })

  await gui.ready()

  // note: would be unhandled rejection on failure, but should never fail:
  if (await gui.ipc.wakeup(state.link, state.storage, state.key === null ? state.dir : null, state.link?.startsWith('pear://dev'))) {
    electron.app.quit(0)
    return
  }

  electron.ipcMain.on('send-to', (e, id, channel, message) => { electron.webContents.fromId(id)?.send(channel, message) })

  const app = await gui.app()
  app.unloading().then(async () => {
    await app.close()
  }) // note: would be unhandled rejection on failure, but should never fail
}

function configureElectron () {
  const appName = applingName()
  if (appName) {
    process.title = appName
    electron.app.on('ready', () => { process.title = appName })
  }

  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

  /* c8 ignore start */
  const inspix = process.argv.indexOf('--inspector-port')
  if (inspix > -1) {
    electron.app.commandLine.appendSwitch('remote-debugging-port', inspix + 1)
  }
  /* c8 ignore stop */
  electron.protocol.registerSchemesAsPrivileged([
    { scheme: 'file', privileges: { secure: true, bypassCSP: true, corsEnabled: true, supportFetchAPI: true, allowServiceWorkers: true } }
  ])

  // TODO: Remove when issue https://github.com/electron/electron/issues/29458 is resolved.
  electron.app.commandLine.appendSwitch('disable-features', 'WindowCaptureMacV2')

  // Needed for running fully-local WebRTC proxies
  electron.app.commandLine.appendSwitch('allow-loopback-in-peer-connection')

  if (isLinux && process.env.XDG_SESSION_TYPE === 'wayland') {
    electron.app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer,WaylandWindowDecorations')
    electron.app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
  }
}

function applingPath () {
  const i = process.argv.indexOf('--appling')
  if (i === -1 || process.argv.length <= i + 1) return null
  return process.argv[i + 1]
}

function applingName () {
  const a = applingPath()
  if (!a) return null

  if (isMac) {
    const end = a.indexOf('.app')
    if (end === -1) return null
    const start = a.lastIndexOf('/', end) + 1
    return a.slice(start, end)
  }

  if (isWindows) {
    const name = a.slice(a.lastIndexOf('\\') + 1).replace(/\.exe$/i, '')
    return name || null
  }

  return null
}
