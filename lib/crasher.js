'use strict'
const { isBare, platform, arch } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const checkout = require('../checkout')
const os = isBare ? require('bare-os') : require('os')
const pid = isBare ? Bare.pid : global.process.pid

let hasLogged = false
const start = Date.now()
function logCrash (logPath, errorInfo, checkout, stackTrace, err) {
  if (hasLogged) return // Safety: only logging 1 crash per run
  hasLogged = true

  const timeStamp = (new Date()).toISOString()
  const uptime = (Date.now() - start) / 1000
  const driveInfo = `key=${checkout.key}\nlength=${checkout.length}\nfork=${checkout.fork}`
  const processInfo = `platform=${platform}\narch=${arch}\npid=${pid}\nuptime=${uptime}s`
  const errInfo = err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${timeStamp} ${errorInfo}\n${driveInfo}\n${processInfo}\nstack=${stackTrace + errInfo}\n\n`

  console.error(errorMsg)
  fs.writeFileSync(logPath, errorMsg, { flag: 'a', encoding: 'utf8' })

  console.error(`Error logged at ${logPath}`)
}

function printCrash (errorInfo, stackTrace, err) {
  const errInfo = err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${stackTrace + errInfo}\n\n${errorInfo}`

  console.error(errorMsg)
}

function logAndExit (enableLog, logPath, errorInfo, checkout, stack, err) {
  if (enableLog) {
    logCrash(logPath, errorInfo, checkout, stack, err)
  } else {
    printCrash(errorInfo, stack, err)
  }

  if (isBare) {
    os.kill(pid)
  } else {
    const runContext = isBare ? global.Bare : (global.process.versions.electron ? require('electron').app : global.process)
    runContext.exit(1)
  }
}

function setupCrashHandlers (processName, swap, enableLog) {
  const crashlogPath = path.join(swap, `${processName}.crash.log`)
  const runContext = isBare ? global.Bare : global.process

  runContext.on('unhandledRejection', (reason) => {
    const stack = reason?.stack || reason || ''
    const errorInfo = `${processName} exiting due to unhandled rejection`
    logAndExit(enableLog, crashlogPath, errorInfo, checkout, stack, reason)
  })

  runContext.on('uncaughtException', (err) => {
    const errorInfo = `${processName} exiting due to uncaught exception`
    logAndExit(enableLog, crashlogPath, errorInfo, checkout, err.stack, err)
  })
}

module.exports = setupCrashHandlers
