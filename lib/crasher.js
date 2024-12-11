'use strict'
const { isBare, platform, arch } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const checkout = require('../checkout')
const os = isBare ? require('bare-os') : require('os')

let hasLogged = false
const start = Date.now()
function logCrashAndExit (logPath, errorInfo, checkout, stackTrace, err) {
  if (hasLogged) return // Safety: only logging 1 crash per run
  hasLogged = true

  // Electron does not play well with process.exit, so use app.exit instead
  const runContext = isBare ? global.Bare : (global.process.versions.electron ? require('electron').app : global.process)
  const timeStamp = (new Date()).toISOString()
  const pid = isBare ? Bare.pid : global.process.pid
  const uptime = (Date.now() - start) / 1000
  const driveInfo = `key=${checkout.key}\nlength=${checkout.length}\nfork=${checkout.fork}`
  const processInfo = `platform=${platform}\narch=${arch}\npid=${pid}\nuptime=${uptime}s`
  const errInfo = err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${timeStamp} ${errorInfo}\n${driveInfo}\n${processInfo}\nstack=${stackTrace + errInfo}\n\n`

  console.error(errorMsg)
  fs.writeFileSync(logPath, errorMsg, { flag: 'a', encoding: 'utf8' })

  console.error(`Error logged at ${logPath}`)

  if (isBare) {
    os.kill(pid)
  } else {
    runContext.exit(1)
  }
}

function printAndExit (errorInfo, stackTrace, err) {
  // Electron does not play well with process.exit, so use app.exit instead
  const runContext = isBare ? global.Bare : (global.process.versions.electron ? require('electron').app : global.process)
  const pid = isBare ? Bare.pid : global.process.pid
  const errInfo = err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${stackTrace + errInfo}\n\n${errorInfo}`

  console.error(errorMsg)

  if (isBare) {
    os.kill(pid)
  } else {
    runContext.exit(1)
  }
}

function setupCrashHandlers (processName, swap, enableLog) {
  const crashlogPath = path.join(swap, `${processName}.crash.log`)
  const runContext = isBare ? global.Bare : global.process

  runContext.on('unhandledRejection', (reason) => {
    const stack = reason?.stack || reason || ''
    const errorInfo = `${processName} exiting due to unhandled rejection`
    if (enableLog) {
      logCrashAndExit(crashlogPath, errorInfo, checkout, stack, reason)
    } else {
      printAndExit(errorInfo, stack, reason)
    }
  })

  runContext.on('uncaughtException', (err) => {
    const errorInfo = `${processName} exiting due to uncaught exception`
    if (enableLog) {
      logCrashAndExit(crashlogPath, errorInfo, checkout, err.stack, err)
    } else {
      printAndExit(errorInfo, err.stack, err)
    }
  })
}

module.exports = setupCrashHandlers
