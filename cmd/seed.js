'use strict'
const context = require('../context')
const plink = require('pear-link')
const bareTTY = require('bare-tty')
const hypercoreid = require('hypercore-id-encoding')

const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, isTTY, byteSize, stdio } = require('../lib/terminal.js')
const { Table, DictTable, TableLayout } = require('../lib/table.js')
const { cmdArgs } = require('../argv')

let resizeHandler

module.exports = async function seed(cmd) {
  const ipc = context.getIPC()
  const { json, tty } = cmd.flags
  let statsInterval = cmd.flags.statsInterval ?? (tty === false ? 3000 : 500)
  const link = cmd.args.link
  if (!link || plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  }
  statsInterval = +statsInterval
  if (Number.isInteger(+statsInterval) === false) {
    throw ERR_INVALID_INPUT('--stats-interval flag must supply an integer if set')
  }
  const id = Bare.pid
  const { width } = stdio.size()
  const ctrlTTY = !json && tty !== false && isTTY && !!width
  const initial = ctrlTTY ? ansi.dim('loading...') : 'loading...'

  const stats = new DictTable([
    {
      key: 'link',
      label: ctrlTTY ? 'Seeding:' : '... seeding',
      initial,
      transform: (v) => (ctrlTTY ? ansi.bold(ansi.green(v)) : v)
    },
    {
      key: 'driveKey',
      label: ctrlTTY ? 'Drive Key:' : '... drive key',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'driveLength',
      label: ctrlTTY ? 'Drive Length:' : '... drive length',
      initial
    },
    {
      key: 'discoveryKey',
      label: ctrlTTY ? 'Discovery Key:' : '... discovery key',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'contentKey',
      label: ctrlTTY ? 'Content Key:' : '... content key',
      initial,
      transform: (v) => (ctrlTTY ? (v === 'pending' ? ansi.yellow(v) : ansi.gray(v)) : v)
    },
    {
      key: 'firewalled',
      label: ctrlTTY ? 'Firewalled:' : '... firewalled',
      initial,
      transform: (v) => v ?? 'unknown'
    },
    {
      key: 'natType',
      label: ctrlTTY ? 'NAT Type:' : '... NAT type',
      initial,
      transform: (v) => String(v ?? 'unknown').toLowerCase()
    },
    {
      key: 'whoami',
      label: ctrlTTY ? 'Whoami:' : '... whoami',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
    },
    {
      key: 'network',
      label: ctrlTTY ? 'Network:' : '---',
      initial
    }
  ])
  const peers = new Table()
  const layout = new TableLayout(
    [
      { type: 'border', char: ' ' },
      { type: 'table', table: stats },
      { type: 'border', char: '─' },
      { type: 'table', table: peers }
    ],
    { appendMode: !ctrlTTY }
  )

  if (ctrlTTY) {
    stdio.in?.setMode?.(bareTTY.constants.MODE_RAW)
    stdio.in?.on('data', (key) => {
      // Ctrl-C
      if (key.toString() === '\u0003') {
        // restore cursor then exit
        return stdio.out.write(`\x1b[?25h`, () => {
          Bare.exit(0)
        })
      }

      const selectedTable = layout.selectedTable
      if (selectedTable) {
        if (key.toString() === '\u001b[A') {
          selectedTable.up()
        } else if (key.toString() === '\u001b[B') {
          selectedTable.down()
        } else if (key.toString() === '\u0009') {
          layout.selectNextScrollable()
        }
      }

      layout.print(stdio)
    })
  } else if (tty === false && isTTY) {
    stdio.in?.setMode?.(bareTTY.constants.MODE_RAW)
    stdio.in?.on('data', (key) => {
      if (key.toString() === '\u0003') Bare.exit(0)
    })
  }

  stats.set('link', link)

  if (ctrlTTY) {
    stdio.out.off('resize', resizeHandler)
    resizeHandler = () => {
      layout.print(stdio, { clearScrollback: true })
    }
    stdio.out.on('resize', resizeHandler)
  }

  if (!json) layout.print(stdio, { clearScrollback: true })

  const output = outputter('seed', {
    announced: () => {
      const msg = ctrlTTY
        ? `${ansi.gray('^_^')} ${ansi.bold(ansi.green('announced'))}`
        : '^_^ announced'
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-add': (info) => {
      info = hypercoreid.normalize(info)
      const msg = ctrlTTY
        ? `${ansi.gray('o-o')} ${ansi.green('peer join')} ${ansi.gray(info)}`
        : `o-o peer join ${info}`
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-remove': (info) => {
      info = hypercoreid.normalize(info)
      const msg = ctrlTTY
        ? `${ansi.gray('-_-')} ${ansi.yellow('peer drop')} ${ansi.gray(info)}`
        : `-_- peer drop ${info}`
      peers.append([msg])
      layout.print(stdio)
    },
    stats({
      peers,
      driveKey,
      driveLength,
      discoveryKey,
      contentKey,
      firewalled,
      natType,
      whoami,
      upload,
      download
    }) {
      const network = ctrlTTY
        ? `[ Peers ${ansi.green(peers)} ]  [ ${ansi.up} ${ansi.green(byteSize(upload.totalBytes))} - ${ansi.green(`${byteSize(upload.speed)}/s`)} ]  [ ${ansi.down} ${ansi.green(byteSize(download.totalBytes))} - ${ansi.green(`${byteSize(download.speed)}/s`)} ]`
        : `network ${peers} peers, upload ${byteSize(upload.totalBytes)} - ${byteSize(upload.speed)}/s, download ${byteSize(download.totalBytes)} - ${byteSize(download.speed)}/s`

      stats.update({
        driveKey: hypercoreid.normalize(driveKey),
        driveLength,
        discoveryKey: hypercoreid.normalize(discoveryKey),
        contentKey: hypercoreid.isValid(contentKey)
          ? hypercoreid.normalize(contentKey)
          : contentKey,
        firewalled,
        natType,
        whoami: hypercoreid.normalize(whoami),
        network
      })

      layout.print(stdio)
    },
    error: (err) => {
      return `Seed Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  })

  await output(
    { json, ctrlTTY },
    ipc.seed({
      id,
      link,
      statsInterval,
      cmdArgs
    })
  )
}
