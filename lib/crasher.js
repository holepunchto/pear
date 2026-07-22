'use strict'

function setupCrashHandlers(label) {
  const runContext = global.Bare

  runContext.on('unhandledRejection', (err) => {
    LOG.error(label, 'Exiting due to unhandled rejection', err)
    global.Bare.exit(1)
  })

  runContext.on('uncaughtException', (err) => {
    LOG.error(label, 'Exiting due to uncaught exception', err)
    global.Bare.exit(1)
  })
}

module.exports = setupCrashHandlers
