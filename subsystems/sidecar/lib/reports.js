'use strict'
const generic = (message, stack, info) => ({
  type: 'generic',
  message,
  stack,
  info,
  headline: { content: 'Something has gone wrong' },
  tagline: { content: 'An error has occurred which cannot be recovered from. Upgrading might help.' },
  cta: { content: 'QUIT', action: 'quit' }
})

const crash = (message, stack, info) => ({
  type: 'crash',
  message,
  stack,
  info,
  headline: { content: message },
  tagline: { content: JSON.stringify(info) },
  cta: { content: 'QUIT', action: 'quit' }
})

const dev = (message, stack, info) => ({
  type: 'dev',
  message,
  stack,
  info,
  headline: { content: message },
  tagline: { content: info?.code || 'development error' },
  cta: { content: 'QUIT', action: 'quit' }
})

const connection = () => ({
  type: 'connection',
  headline: { content: 'There seems to be a connection problem' },
  tagline: { content: 'Check the application key and/or your network and try again' },
  cta: { content: 'QUIT', action: 'quit' }
})

const upgrade = () => ({
  type: 'upgrade',
  headline: { content: 'Hey great news! A new version is available 🎉' },
  tagline: { content: 'You can always find the latest version at <a href="https://keet.io">https://keet.io</a>' },
  cta: { content: 'QUIT', action: 'quit' }
})

const minver = (report) => ({
  type: 'minver',
  headline: { content: 'This application specifies a non-existent minimum platform version' },
  tagline: { content: report.err?.checkout ? `v${report.err.checkout.fork}.${report.err.checkout.length}.${report.err.checkout.key} cannot be found` : JSON.stringify(report) },
  cta: { content: 'QUIT', action: 'quit' }
})

const update = (report) => {
  return {
    type: 'update',
    version: report.version
  }
}

const permissionRequired = (report) => {
  return {
    type: 'permissionRequired',
    key: report.err.info.key
  }
}

module.exports = { generic, crash, dev, connection, upgrade, minver, update, permissionRequired }
