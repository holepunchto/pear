'use strict'
const context = require('../context')
const hypercoreid = require('hypercore-id-encoding')

const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, byteSize, stdio, TerminalTableRenderer } = require('../lib/terminal.js')
const { Table, DictTable, TableLayout } = require('../lib/table.js')
const { cmdArgs } = require('../argv')
const { parse } = require('../lib/link')

module.exports = async function seed(cmd) {
  const ipc = context.getIPC()
  const { json, tty } = cmd.flags
  const untilSync = cmd.flags.untilSync
  const blindPeer = cmd.flags.blindPeer
  let statsInterval = cmd.flags.statsInterval ?? (tty === false ? 3000 : 500)
  const link = cmd.args.link
  parse(link)

  statsInterval = +statsInterval
  if (Number.isInteger(+statsInterval) === false) {
    throw ERR_INVALID_INPUT('--stats-interval flag must supply an integer if set')
  }
  if (untilSync?.some((key) => hypercoreid.isValid(key) === false)) {
    throw ERR_INVALID_INPUT('--until-sync <key> must supply a valid z32 key')
  }
  if (blindPeer && !hypercoreid.isValid(blindPeer)) {
    throw ERR_INVALID_INPUT('--blind-peer <key> must supply a valid z32 key')
  }
  const id = Bare.pid

  const terminalTableRenderer = new TerminalTableRenderer({
    tty,
    json,
    untilSync: untilSync || blindPeer
  })
  const ctrlTTY = terminalTableRenderer.ctrlTTY
  const initial = ctrlTTY ? ansi.dim('loading...') : 'loading...'
  let blocksWidth = 0
  const transformLength = ({ synced, length, isSynced }) => {
    const percentage = isSynced ? 100 : length === 0 ? 0 : Math.floor((synced / length) * 100)
    const blocks = isSynced ? length : `${synced}/${length}`
    if (!ctrlTTY) return `${blocks} [ ${percentage}% ]`
    const blocksLabel = String(blocks).padEnd(blocksWidth)
    const percentageLabel = `[${String(percentage).padStart(3)}%]`
    const progress = `${blocksLabel}${percentageLabel}`
    return isSynced ? `${blocksLabel}${ansi.gray(percentageLabel)}` : ansi.yellow(progress)
  }

  const stats = new DictTable([
    {
      key: 'link',
      label: ctrlTTY ? 'Seeding:' : '... seeding',
      initial,
      transform: (v) => (ctrlTTY ? ansi.bold(ansi.green(v)) : v)
    },
    {
      key: 'app',
      label: ctrlTTY ? 'App:' : '... app',
      initial
    },
    {
      key: 'verlink',
      label: ctrlTTY ? 'Verlink:' : '... verlink',
      initial,
      transform: (v) => (ctrlTTY ? ansi.gray(v) : v)
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
      initial,
      transform: transformLength
    },
    {
      key: 'blobsLength',
      label: ctrlTTY ? 'Blobs Length:' : '... blobs length',
      initial,
      transform: transformLength
    },
    {
      key: 'blobsByteLength',
      label: ctrlTTY ? 'Blobs Size:' : '... blobs size',
      initial,
      transform: byteSize
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
  terminalTableRenderer.setTable(layout)

  stats.set('link', link)

  const output = outputter('seed', {
    announced: () => {
      const msg = ctrlTTY
        ? `${ansi.gray('^_^')} ${ansi.bold(ansi.green('announced'))}`
        : '^_^ announced'
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'peer-add': (info) => {
      info = hypercoreid.normalize(info)
      const msg = ctrlTTY
        ? `${ansi.gray('o-o')} ${ansi.green('peer join')} ${ansi.gray(info)}`
        : `o-o peer join ${info}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'peer-remove': (info) => {
      info = hypercoreid.normalize(info)
      const msg = ctrlTTY
        ? `${ansi.gray('-_-')} ${ansi.yellow('peer drop')} ${ansi.gray(info)}`
        : `-_- peer drop ${info}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'peer-sync': (info) => {
      info = hypercoreid.normalize(info)
      const msg = ctrlTTY
        ? `${ansi.gray('^_^')} ${ansi.bold(ansi.green('peer sync'))} ${ansi.gray(info)}`
        : `^_^ peer sync ${info}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'adding-core': ({ key, peerKey }) => {
      key = hypercoreid.normalize(key)
      peerKey = hypercoreid.normalize(peerKey)
      const msg = ctrlTTY
        ? `${ansi.gray('o-o')} ${ansi.green(`adding core ${ansi.gray(key)} to blind peer ${ansi.gray(peerKey)}`)}`
        : `o-o adding core ${key} to blind peer ${peerKey}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'confirming-core': ({ key, peerKey }) => {
      key = hypercoreid.normalize(key)
      peerKey = hypercoreid.normalize(peerKey)
      const msg = ctrlTTY
        ? `${ansi.gray('>-<')} ${ansi.green(`confirming add core ${ansi.gray(key)} to blind peer ${ansi.gray(peerKey)}`)}`
        : `>-< confirming add core ${key} to blind peer ${peerKey}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    'added-core': ({ key, peerKey }) => {
      key = hypercoreid.normalize(key)
      peerKey = hypercoreid.normalize(peerKey)
      const msg = ctrlTTY
        ? `${ansi.gray('^-^')} ${ansi.bold(ansi.green(`added core ${ansi.gray(key)} to blind peer ${ansi.gray(peerKey)}`))}`
        : `^-^ added core ${key} to blind peer ${peerKey}`
      peers.append([msg])
      terminalTableRenderer.render()
    },
    final: () => {
      if (ctrlTTY) {
        stdio.out.write('\n\n')
        return false
      }
    },
    stats({
      peers,
      driveKey,
      verlink,
      driveSynced,
      driveLength,
      blobsSynced,
      blobsLength,
      blobsByteLength,
      name,
      semver,
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
      const isDriveSynced = driveSynced === driveLength
      const isBlobsSynced = hypercoreid.isValid(contentKey) && blobsSynced === blobsLength
      const driveBlocks = isDriveSynced ? driveLength : `${driveSynced}/${driveLength}`
      const blobsBlocks = isBlobsSynced ? blobsLength : `${blobsSynced}/${blobsLength}`
      blocksWidth = Math.max(String(driveBlocks).length, String(blobsBlocks).length) + 1
      stats.update({
        app: `${name ?? ''}${semver ? `@${semver}` : ''}` || '-',
        verlink,
        driveKey: hypercoreid.normalize(driveKey),
        driveLength: {
          synced: driveSynced,
          length: driveLength,
          isSynced: isDriveSynced
        },
        blobsLength: {
          synced: blobsSynced,
          length: blobsLength,
          isSynced: isBlobsSynced
        },
        blobsByteLength,
        discoveryKey: hypercoreid.normalize(discoveryKey),
        contentKey: hypercoreid.isValid(contentKey)
          ? hypercoreid.normalize(contentKey)
          : contentKey,
        firewalled,
        natType,
        whoami: hypercoreid.normalize(whoami),
        network
      })

      terminalTableRenderer.render()
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
      untilSync,
      blindPeer,
      statsInterval,
      cmdArgs
    })
  )

  if (ctrlTTY && (untilSync || blindPeer)) Bare.exit(0)
}
