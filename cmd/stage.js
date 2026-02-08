'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi } = require('pear-terminal')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { permit, isTTY, byteDiff } = require('pear-terminal')
const State = require('pear-state')
const Pre = require('../pre')

function hints(skips) {
  return skips.length === 0
    ? ''
    : '\n\n' +
        skips.map(({ specifier, referrer }, idx) => {
          return `${ansi.dim(ansi.dot)} ${ansi.bold('skip')} "${specifier}" not found from "${referrer}"${idx < skips.length - 1 ? '\n' : ''}`
        })
}

const output = outputter('stage', {
  staging: ({ name, channel, link, verlink, current, release }) => {
    const rel = `Release: ${release > 0 ? release : release + ansi.bold(ansi.dim(' [UNRELEASED]'))}`
    return `\n${ansi.pear} Staging ${name} into ${channel}\n\n[  ${ansi.dim(link)}  ]\n${ansi.gray(ansi.dim(verlink))}\n\nCurrent: ${current}\n${rel}\n`
  },
  skipping: ({ reason }) => 'Skipping warmup (' + reason + ')',
  dry: 'NOTE: This is a dry run, no changes will be persisted.\n',
  complete: ({ dryRun }) => {
    return dryRun ? '\nStaging dry run complete!\n' : '\nStaging complete!\n'
  },
  compact: (data) => {
    const { files, skips } = data
    return (
      'Compact stage static-analysis:-\n' + '- files: ' + files.length + '- skips: ' + skips.length
    )
  },
  warmed: (data) => {
    const { blocks, total, skips } = data
    return 'Warmed up app (used ' + blocks + '/' + total + ' blocks)' + hints(skips)
  },
  error: async (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'stage')
    } else {
      return `Staging Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  },
  addendum: ({ version, release, channel, link, verlink }) => {
    const rel = `Release: ${release > 0 ? release : release + ansi.bold(ansi.dim(' [UNRELEASED]'))}`
    return `${ansi.dim(ansi.bold('^'))}Latest: ${ansi.bold(version)}\n${rel}\n\nUse ${ansi.bold(`pear release ${channel}`)} to set release to latest\n\n${ansi.gray(ansi.dim(verlink))}\n[  ${ansi.dim(link)}  ]\n`
  },
  ['byte-diff']: byteDiff,
  preio({ from, output, index, fd }, { preio }) {
    if (!preio) return {}
    const io = fd === 1 ? 'stdout' : 'stderr'
    const pre = 'Pre-stage [' + index + ':' + from + ':' + io + ']: '
    return pre + output
  },
  pre({ from, output, index, success }, { preQ }) {
    if (preQ) return {}
    const pre =
      index > 0 ? 'Pre-stage [' + index + ':' + from + ']: ' : 'Pre-stage [' + from + ']: '
    const suffix = LOG.INF ? ' - ' + JSON.stringify(output.data) : ''
    if (success === false)
      return {
        success: false,
        message: output?.stack || output?.message || 'Unknown Pre Error'
      }
    return pre + output.tag + suffix
  },
  final(data, info) {
    if (info.pre) return {}
    return data
  }
})

module.exports = async function stage(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { dryRun, bare, json, ignore, purge, name, truncate, only, compact } = cmd.flags
  const isKey = cmd.args.channel && plink.parse(cmd.args.channel).drive.key !== null
  const channel = isKey ? null : cmd.args.channel
  const key = isKey ? cmd.args.channel : null
  if (!channel && !key) throw ERR_INVALID_INPUT('A key or the channel name must be specified')
  const cwd = os.cwd()
  let { dir = cwd } = cmd.args
  if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
  const id = Bare.pid
  const base = { cwd, dir }
  let pkg = null
  if (cmd.flags.pre) {
    pkg = await State.localPkg(base)
    if (pkg !== null) {
      const pre = new Pre('stage', { dir, cwd }, pkg)
      pkg = await output({ ctrlTTY: false, json }, pre, {
        pre: true,
        preQ: cmd.flags.preQ,
        preio: cmd.flags.preIo
      })
    }
  }
  const stream = ipc.stage({
    id,
    channel,
    key,
    dir,
    dryRun,
    bare,
    ignore,
    purge,
    name,
    truncate,
    only,
    compact,
    cmdArgs: Bare.argv.slice(1),
    pkg
  })
  await output(json, stream, { ask: cmd.flags.ask }, ipc)
}
