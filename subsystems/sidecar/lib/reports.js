'use strict'
const hypercoreid = require('hypercore-id-encoding')
const generic = (message, stack, info) => ({
  type: 'generic',
  message,
  stack,
  info,
  headline: { content: 'Something has gone wrong' },
  tagline: {
    content: 'An error has occurred which cannot be recovered from. Upgrading might help.'
  },
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

const connection = (report) => ({
  type: 'connection',
  headline: { content: 'There seems to be a connection problem' },
  tagline: {
    content: 'Check the application key and/or your network and try again'
  },
  cta: { content: 'QUIT', action: 'quit' },
  reason: report?.err?.info?.err?.stack
})

const upgrade = () => ({
  type: 'upgrade',
  headline: { content: 'Hey great news! A new version is available 🎉' },
  tagline: {
    content:
      'You can always find the latest version at <a href="https://keet.io">https://keet.io</a>'
  },
  cta: { content: 'QUIT', action: 'quit' }
})

const update = (report) => {
  const { version } = report
  const { current } = version
  const from =
    'pear://' + current.fork + '.' + current.length + '.' + hypercoreid.normalize(current.key)
  const to =
    'pear://' + version.fork + '.' + version.length + '.' + hypercoreid.normalize(version.key)
  return {
    type: 'update',
    headline: {
      content: 'Minimum Pear version required by ' + version.applink
    },
    tagline: { content: 'Pear is updating from ' + from + ' to ' + to },
    version: report.version
  }
}

const permission = (report) => {
  return {
    type: 'permission-required',
    key: report.err.info.key,
    encrypted: report.err.info.encrypted
  }
}

module.exports = {
  generic,
  crash,
  dev,
  connection,
  upgrade,
  update,
  permission
}
