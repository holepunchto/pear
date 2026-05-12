'use strict'
const context = require('../context')
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi } = require('pear-terminal')
const { permit, isTTY, byteDiff } = require('pear-terminal')

const output = outputter('stage', {
  staging: ({ name, link, verlink, current, release }) => {
    const rel = `Release: ${release > 0 ? release : release + ansi.bold(ansi.dim(' [UNRELEASED]'))}`
    return `\n${ansi.pear} Staging ${name}\n\n[  ${ansi.dim(link)}  ]\n${ansi.gray(ansi.dim(verlink))}\n\nCurrent: ${current}\n${rel}\n`
  },
  skipping: ({ reason }) => 'Skipping (' + reason + ')',
  dry: 'NOTE: This is a dry run, no changes will be persisted.\n',
  complete: ({ dryRun }) => {
    return dryRun ? '\nStaging dry run complete!\n' : '\nStaging complete!\n'
  },
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'stage')
    } else {
      return `Staging Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  },
  addendum: ({ version, release, link, verlink }) => {
    const rel = `Release: ${release > 0 ? release : release + ansi.bold(ansi.dim(' [UNRELEASED]'))}`
    return `${ansi.dim(ansi.bold('^'))}Latest: ${ansi.bold(version)}\n${rel}\n\nUse ${ansi.bold(`pear release ${link}`)} to set release to latest\n\n${ansi.gray(ansi.dim(verlink))}\n[  ${ansi.dim(link)}  ]\n`
  },
  ['byte-diff']: byteDiff,
  final: (data) => data
})

module.exports = async function stage(cmd) {
  const ipc = context.getIPC()
  const { dryRun, bare, json, ignore, purge, name, truncate, only } = cmd.flags
  const cwd = os.cwd()
  const link = cmd.args.link
  if (!link || plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  }
  let { dir = cwd } = cmd.args
  // Some standalone argv layouts can cause paparam to fall back to the default [dir=.].
  // Recover the user-supplied 2nd positional when available.
  if (
    (dir === '.' || dir === cwd) &&
    Array.isArray(cmd.positionals) &&
    cmd.positionals.length > 1 &&
    cmd.positionals[1]
  ) {
    dir = cmd.positionals[1]
  }
  if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
  const id = Bare.pid
  const stream = ipc.stage({
    id,
    link,
    dir,
    dryRun,
    bare,
    ignore,
    purge,
    name,
    truncate,
    only,
    cmdArgs: Bare.argv.slice(1)
  })
  await output(json, stream, { ask: cmd.flags.ask }, ipc)
}
