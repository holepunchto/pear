'use strict'
const { platform, arch } = require('which-runtime')
const fs = require('bare-fs')
const path = require('bare-path')
const pid = global.Bare.pid
const { PLATFORM_DIR, UPGRADE } = require('../constants.js')

let hasLoggedUnhandledRejection = false
let hasLoggedUncaughtException = false

const start = Date.now()
function logCrash(logPath, errorInfo, stackTrace, err) {
  const timeStamp = new Date().toISOString()
  const uptime = (Date.now() - start) / 1000
  const processInfo = `platform=${platform}\narch=${arch}\npid=${pid}\nuptime=${uptime}s`
  const errInfo =
    err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${timeStamp} ${errorInfo}\n ${UPGRADE}\n${processInfo}\nstack=${stackTrace + errInfo}\n\n`

  console.error(errorMsg)
  fs.writeFileSync(logPath, errorMsg, { flag: 'a', encoding: 'utf8' })

  console.error(`Error logged at ${logPath}`)
}

function printCrash(errorInfo, stackTrace, err) {
  const errInfo =
    err !== null && typeof err === 'object' ? JSON.stringify(err, 0, 4).slice(1, -2) : ''
  const errorMsg = `${stackTrace + errInfo}\n\n${errorInfo}`

  console.error(errorMsg)
}

function logAndExit(enableLog, logPath, errorInfo, stack, err) {
  if (enableLog) {
    logCrash(logPath, errorInfo, stack, err)
  } else {
    printCrash(errorInfo, stack, err)
  }

  global.Bare.exit(1)
}

function setupCrashHandlers(processName, enableLog) {
  const crashlogPath = path.join(PLATFORM_DIR, `${processName}.crash.log`)
  const runContext = global.Bare

  runContext.on('unhandledRejection', (reason) => {
    if (hasLoggedUnhandledRejection) return
    hasLoggedUnhandledRejection = true

    const stack = reason?.stack || reason || ''
    const errorInfo = `${processName} exiting due to unhandled rejection`
    logAndExit(enableLog, crashlogPath, errorInfo, stack, reason)
  })

  runContext.on('uncaughtException', (err) => {
    if (hasLoggedUncaughtException) return
    hasLoggedUncaughtException = true

    const errorInfo = `${processName} exiting due to uncaught exception`
    logAndExit(enableLog, crashlogPath, errorInfo, err.stack, err)
  })
}

module.exports = setupCrashHandlers
