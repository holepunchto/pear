'use strict'
const electron = require('electron')
const { isWindows, isMac, isLinux } = require('which-runtime')
const Context = require('./ctx/shared')
const GUI = require('./gui')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./lib/constants')

configureElectron()
crasher('electron-main', SWAP)
electronMain().catch(console.error)
async function electronMain () {
  const ctx = new Context({
    argv: (process.argv.length > 1 && process.argv[1][0] === '-')
      ? process.argv.slice(1)
      : process.argv.slice(2)
  })
  Context.storage(ctx)
  if (ctx.error) {
    console.error(ctx.error)
    electron.app.quit(1)
    return
  }
  const gui = new GUI({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    tryboot,
    ctx
  })
  await gui.ready()

  // note: would be unhandled rejection on failure, but should never fail:
  if (await gui.scipc.wakeup(ctx.link, ctx.storage, ctx.dir && ctx.link?.startsWith('pear://dev'))) {
    electron.app.quit(0)
    return
  }

  const app = await gui.app()

  gui.emipc.unloading({ id: app.id }).then(() => {
    app.close()
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
