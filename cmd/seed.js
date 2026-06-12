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
  const appendMode = json || tty === false || !isTTY || !width
  const loading = ansi.dim('loading...')

  const stats = new DictTable([
    {
      key: 'link',
      label: appendMode ? `${ansi.gray('...')} seeding` : 'Seeding:',
      initial: loading,
      transform: (v) => ansi.bold(ansi.green(v))
    },
    {
      key: 'driveKey',
      label: appendMode ? `${ansi.gray('...')} drive key` : 'Drive Key:',
      initial: loading,
      transform: (v) => ansi.gray(v)
    },
    {
      key: 'driveLength',
      label: appendMode ? `${ansi.gray('...')} drive length` : 'Drive Length:',
      initial: loading
    },
    {
      key: 'discoveryKey',
      label: appendMode ? `${ansi.gray('...')} discovery key` : 'Discovery Key:',
      initial: loading,
      transform: (v) => ansi.gray(v)
    },
    {
      key: 'contentKey',
      label: appendMode ? `${ansi.gray('...')} content key` : 'Content Key:',
      initial: loading,
      transform: (v) => (v === 'pending' ? ansi.yellow(v) : ansi.gray(v))
    },
    {
      key: 'firewalled',
      label: appendMode ? `${ansi.gray('...')} firewalled` : 'Firewalled:',
      initial: loading,
      transform: (v) => v ?? 'unknown'
    },
    {
      key: 'natType',
      label: appendMode ? `${ansi.gray('...')} NAT type` : 'NAT Type:',
      initial: loading,
      transform: (v) => String(v ?? 'unknown').toLowerCase()
    },
    {
      key: 'whoami',
      label: appendMode ? `${ansi.gray('...')} whoami` : 'Whoami:',
      initial: loading,
      transform: (v) => `${ansi.bold(v.slice(0, 4))}${ansi.gray(v.slice(4))}`
    },
    {
      key: 'network',
      label: appendMode ? ansi.gray('---') : 'Network:',
      initial: loading
    }
  ])
  const peers = new Table()
  const layout = new TableLayout(
    [
      { type: 'border' },
      { type: 'table', table: stats },
      { type: 'border' },
      { type: 'table', table: peers }
    ],
    { appendMode }
  )

  if (!appendMode) {
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

  if (!appendMode) {
    stdio.out.off('resize', resizeHandler)
    resizeHandler = () => {
      layout.print(stdio, { clearScrollback: true })
    }
    stdio.out.on('resize', resizeHandler)
  }

  if (!json) layout.print(stdio, { clearScrollback: true })

  const output = outputter('seed', {
    announced: () => {
      const msg = `${ansi.gray('^_^')} ${ansi.bold(ansi.green('announced'))}`
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-add': (info) => {
      info = hypercoreid.normalize(info)
      const msg = `${ansi.gray('o-o')} ${ansi.green('peer join')} ${ansi.bold(info.slice(0, 4))}${ansi.gray(info.slice(4))}`
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-remove': (info) => {
      info = hypercoreid.normalize(info)
      const msg = `${ansi.gray('-_-')} ${ansi.yellow('peer drop')} ${ansi.bold(info.slice(0, 4))}${ansi.gray(info.slice(4))}`
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
      const network = appendMode
        ? `network ${ansi.green(peers)} peers, upload ${ansi.green(byteSize(upload.totalBytes))} - ${ansi.green(`${byteSize(upload.speed)}/s`)}, download ${ansi.green(byteSize(download.totalBytes))} - ${ansi.green(`${byteSize(download.speed)}/s`)}`
        : `[ Peers ${ansi.green(peers)} ] [ ${ansi.up} ${ansi.green(byteSize(upload.totalBytes))} - ${ansi.green(`${byteSize(upload.speed)}/s`)} ] [ ${ansi.down} ${ansi.green(byteSize(download.totalBytes))} - ${ansi.green(`${byteSize(download.speed)}/s`)} ]`

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
    { json, ctrlTTY: !appendMode },
    ipc.seed({
      id,
      link,
      statsInterval,
      cmdArgs
    })
  )
}
