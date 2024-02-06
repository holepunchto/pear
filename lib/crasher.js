const fs = require('fs')
const path = require('path')
const checkout = require('../checkout')

let hasLogged = false

function logCrashAndExit (logPath, errorInfo, checkout, stackTrace, err) {
  if (hasLogged) return // Safety: only logging 1 crash per run
  hasLogged = true

  // Electron does not play well with process.exit, so use app.exit instead
  const runContext = process.versions.electron ? require('electron').app : process

  const timeStamp = (new Date()).toISOString()
  const driveInfo = `key=${checkout.key}\nlength=${checkout.length}\nfork=${checkout.fork}`
  const processInfo = `platform=${process.platform}\narch=${process.arch}\npid=${process.pid}\nuptime=${process.uptime()}s`
  const errInfo = err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${timeStamp} ${errorInfo}\n${driveInfo}\n${processInfo}\nstack=${stackTrace + errInfo}\n\n`

  console.error(errorMsg)

  fs.appendFileSync(logPath, errorMsg)
  console.error(`Error logged at ${logPath}`)

  runContext.exit(1)
}

function setupCrashHandlers (processName, swap) {
  const crashlogPath = path.join(swap, `${processName}.crash.log`)

  process.on('unhandledRejection', (reason) => {
    const stack = reason.stack || reason
    const errorInfo = `${processName} exiting due to unhandled rejection`
    logCrashAndExit(crashlogPath, errorInfo, checkout, stack, reason)
  })

  process.on('uncaughtException', (err) => {
    const errorInfo = `${processName} exiting due to uncaught exception`
    logCrashAndExit(crashlogPath, errorInfo, checkout, err.stack, err)
  })
}

module.exports = setupCrashHandlers
