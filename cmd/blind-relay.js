'use strict'
const context = require('../context')

const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, isTTY, stdio, setupTTYInput } = require('../lib/terminal.js')
const { DictTable, TableLayout } = require('../lib/table.js')

let resizeHandler

module.exports = async function blindRelay(cmd) {
  const ipc = context.getIPC()
  const { json, tty } = cmd.flags
  let statsInterval = cmd.flags.statsInterval ?? (tty === false ? 3000 : 500)

  statsInterval = +statsInterval
  if (Number.isInteger(+statsInterval) === false) {
    throw ERR_INVALID_INPUT('--stats-interval flag must supply an integer if set')
  }

  const { width } = stdio.size()
  const ctrlTTY = !json && tty !== false && isTTY && !!width
  const initial = ctrlTTY ? ansi.dim('loading...') : 'loading...'

  const stats = new DictTable([
    {
      key: 'publicKey',
      label: ctrlTTY ? 'Public Key:' : '... public key',
      initial,
      transform: (v) => (ctrlTTY ? ansi.bold(ansi.green(v)) : v)
    },
    {
      key: 'sessionsAccepted',
      label: ctrlTTY ? 'Sessions Accepted:' : '... sessions accepted',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'sessionsOpened',
      label: ctrlTTY ? 'Sessions Opened:' : '... sessions opened',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'sessionsClosed',
      label: ctrlTTY ? 'Sessions Closed:' : '... sessions closed',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'sessionsActive',
      label: ctrlTTY ? 'Sessions Active:' : '... sessions active',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'pairingsRequested',
      label: ctrlTTY ? 'Pairings Requested:' : '... pairings requested',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'pairingsMatched',
      label: ctrlTTY ? 'Pairings Matched:' : '... pairings matched',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'pairingsCancelled',
      label: ctrlTTY ? 'Pairings Cancelled:' : '... pairings cancelled',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'pairingsPending',
      label: ctrlTTY ? 'Pairings Pending:' : '... pairings pending',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'pairingsActive',
      label: ctrlTTY ? 'Pairings Active:' : '... pairings active',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'streamsOpened',
      label: ctrlTTY ? 'Streams Opened:' : '... streams opened',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'streamsClosed',
      label: ctrlTTY ? 'Streams Closed:' : '... streams closed',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'streamsErrors',
      label: ctrlTTY ? 'Streams Errors:' : '... streams errors',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'streamsActive',
      label: ctrlTTY ? 'Streams Active:' : '... streams active',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    }
  ])
  const layout = new TableLayout(
    [
      { type: 'border', char: ' ' },
      { type: 'table', table: stats }
    ],
    { appendMode: !ctrlTTY }
  )

  setupTTYInput({
    ctrlTTY,
    listenForCtrlC: tty === false && isTTY,
    layout
  })

  if (ctrlTTY) {
    stdio.out.off('resize', resizeHandler)
    resizeHandler = () => {
      layout.print(stdio, { clearScrollback: true })
    }
    stdio.out.on('resize', resizeHandler)
  }

  if (!json) layout.print(stdio, { clearScrollback: true })

  const output = outputter('blind-relay', {
    final: () => {
      if (ctrlTTY) {
        stdio.out.write('\n\n')
        return false
      }
    },
    listening: ({ publicKey }) => {
      stats.update({ publicKey })
      layout.print(stdio)
      // return `Blind-relay listening on ${publicKey}`
    },
    stats: ({
      stats: {
        sessions: {
          accepted: sessionsAccepted,
          opened: sessionsOpened,
          closed: sessionsClosed,
          active: sessionsActive
        },
        pairings: {
          requested: pairingsRequested,
          matched: pairingsMatched,
          cancelled: pairingsCancelled,
          pending: pairingsPending,
          active: pairingsActive
        },
        streams: {
          opened: streamsOpened,
          closed: streamsClosed,
          errors: streamsErrors,
          active: streamsActive
        }
      }
    }) => {
      stats.update({
        sessionsAccepted,
        sessionsOpened,
        sessionsClosed,
        sessionsActive,
        pairingsRequested,
        pairingsMatched,
        pairingsCancelled,
        pairingsPending,
        pairingsActive,
        streamsOpened,
        streamsClosed,
        streamsErrors,
        streamsActive
      })
      layout.print(stdio)
    },
    error: ({ code, message, stack }) =>
      `Blind-relay Error (code: ${code || 'none'}) ${message} ${stack}`
  })

  const stream = ipc.blindRelay({ action: cmd.command.name, statsInterval }, ipc)

  await output({ json, ctrlTTY }, stream)
}
