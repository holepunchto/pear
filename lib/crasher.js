'use strict'

const PearError = require('pear-errors')

const unhandled = new Set([
  PearError.ERR_UNKNOWN,
  PearError.ERR_CONNECTION,
  PearError.ERR_UNKNOWN,
  PearError.ERR_ASSERTION,
  PearError.ERR_INTERNAL_ERROR,
  PearError.ERR_OPERATION_FAILED
])

function setupCrashHandlers(label) {
  const runContext = global.Bare

  runContext.on('unhandledRejection', (err) => {
    if (!(err instanceof PearError) || unhandled.has(err.constructor))
      LOG.error(label, 'Exiting due to unhandled rejection', err)
    global.Bare.exit(1)
  })

  runContext.on('uncaughtException', (err) => {
    if (!(err instanceof PearError) || unhandled.has(err.constructor))
      LOG.error(label, 'Exiting due to uncaught exception', err)
    global.Bare.exit(1)
  })
}

module.exports = setupCrashHandlers
