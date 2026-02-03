'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const path = require('bare-path')
const ENV = require('bare-env')
const { pathToFileURL } = require('url-file-url')
const { spawn: daemon } = require('bare-daemon')
const API = require('pear-api')
const constants = require('pear-constants')
const plink = require('pear-link')
const {
  ERR_OPERATION_FAILED,
  ERR_INVALID_PROJECT_DIR,
  ERR_INVALID_INPUT,
  ERR_LEGACY,
  ERR_INTERNAL_ERROR
} = require('pear-errors')
const State = require('pear-state')
const { outputter, permit, byteSize, ansi } = require('pear-terminal')
const Pre = require('../pre')
const noop = () => {}
const preout = outputter('run', {
  preio({ from, output, index, fd }, { io }) {
    if (!io) return {}
    const std = fd === 1 ? 'stdout' : 'stderr'
    const pre = 'Pre-run [' + index + ':' + from + ':' + std + ']: '
    return pre + output
  },
  pre({ from, output, index, success }, { quiet }) {
    if (quiet) return {}
    // only occurs when run from disk
    const pre =
      index > 0
        ? 'Pre-run [' + index + ':' + from + ']: '
        : 'Pre-run [' + from + ']: '
    const suffix = LOG.INF ? ' - ' + JSON.stringify(output.data) : ''
    if (success === false)
      return {
        success: false,
        message: output?.stack || output?.message || 'Unknown Pre Error'
      }
    return pre + output.tag + suffix
  },
  final: {} // hide "{tick} Success"
})

const runout = outputter('run', {
  assetStats({ upload, download, peers }) {
    const dl =
      download.total + download.speed === 0
        ? ''
        : `[${ansi.down} ${byteSize(download.total)} - ${byteSize(download.speed)}/s ] `
    const ul =
      upload.total + upload.speed === 0
        ? ''
        : `[${ansi.up} ${byteSize(upload.total)} - ${byteSize(upload.speed)}/s ] `
    return {
      output: 'status',
      message: `Syncing [ Peers: ${peers} ] ${dl}${ul}`
    }
  },
  final: {} // hide "{tick} Success"
})

module.exports = async function run(cmd, devrun = false) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { flags } = cmd

  const { detached, store: storage } = flags

  if (devrun && !cmd.args.link) {
    cmd.args.link = '.'
    Bare.argv.push('.')
  }

  const cmdArgs = cmd.command.argv
  let args = cmdArgs.slice(1)
  const appArgs = cmd.rest || []
  let link = cmd.args.link
  const { drive, pathname, search, hash } = plink.parse(link)
  const { key } = drive
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = isPear === false && isFile === false
  const onDisk = key === null

  if (onDisk === false && isPear === false)
    throw ERR_INVALID_INPUT('Key must start with pear://')

  const cwd = os.cwd()
  let dir = normalize(flags.base || (onDisk ? pathname : cwd))
  let pkg = null

  if (onDisk) {
    const base = { cwd, dir, entrypoint: '/' }
    pkg = await State.localPkg(base) // may modify base.dir
    if (pkg === null)
      throw ERR_INVALID_PROJECT_DIR(
        `A valid package.json must exist (checked from "${dir}" to "${base.dir}")`
      )
    base.entrypoint = dir.slice(base.dir.length)
    dir = base.dir
    if (dir.length > 1 && dir.endsWith(path.sep)) dir = dir.slice(0, -1)
    if (isPath)
      link =
        plink.normalize(
          pathToFileURL(path.join(dir, base.entrypoint || path.sep)).href
        ) +
        search +
        hash
    if (flags.pre) {
      const pre = new Pre('run', base, pkg)
      pkg = await preout({ ctrlTTY: false, json: flags.json }, pre, {
        io: flags.preIo,
        quiet: flags.preQ
      })
    }
  }

  if (detached) {
    const { wokeup, appling } = await ipc.detached({
      key,
      link,
      storage,
      appdev: onDisk ? dir : null,
      pkg
    })
    if (wokeup) return ipc.close().catch(console.error)
    args = args.filter((arg) => arg !== '--detached')
    const opts = { cwd }
    if (!appling) args.unshift('run', '--detach')
    else args.unshift('run', '--appling', appling)
    daemon(constants.RUNTIME, args, opts)
    return ipc.close().catch(console.error)
  }

  class Reporter {
    display(rpt) {
      if (rpt.type === 'permission-required') return // handled in bail
      console.error(ansi.warning, ansi.bold(rpt.headline.content))
      console.error(rpt.tagline.content)
      if (rpt.message) console.error(rpt.message)
      if (rpt.stack) console.error(rpt.stack)
      if (rpt.info) console.error(rpt.info)
      if (rpt.reason) console.error('reason:', rpt.reason)
    }
  }

  const reporter = new Reporter()
  const stream = ipc.run({
    flags,
    env: ENV,
    dir,
    link,
    cwd,
    args: appArgs,
    cmdArgs,
    pkg,
    pid: os.pid()
  })
  stream.on('data', function ondata({ tag, data }) {
    if (tag !== 'initialized') return
    const [, startId] = data.id.split('@')
    const reporting = ipc.reports({ id: startId })
    reporting.on('error', noop) // ignore rpc destroyed for unexpected run rejects
    reporting.on('data', (data) => reporter.display(data))
    stream.removeListener('data', ondata)
  })

  const replacer = flags.json
    ? (key, value) => {
        if (key === 'data' && value?.bundle)
          return { ...value, bundle: undefined } // prevent bundle from hitting stdio
        return value
      }
    : null

  const result = await runout({ json: replacer }, stream)
  if (result === null) throw ERR_INTERNAL_ERROR('run failure unknown')
  const { startId, id, bundle, entry, bail } = result

  if (bail) {
    if (bail.code === 'PREFLIGHT') return // done
    if (bail.code === 'ERR_CONNECTION') return // handled by reporter
    if (bail.code === 'ERR_PERMISSION_REQUIRED')
      return permit(ipc, bail.info, 'run')
    throw ERR_OPERATION_FAILED(bail.stack || bail.message, bail.info)
  }

  const state = new State({ startId, id, flags, link, dir, cmdArgs, cwd })

  await ipc.ready()

  const config = await ipc.config()

  state.update({ config })
  global.Pear = new API(ipc, state)

  if (entry.endsWith('.html')) {
    const updates = require('pear-updates')
    console.log('Legacy application detected, attempting to heal')
    console.log(
      'Developer Solution: pear run pear://runtime/documentation/migration'
    )
    console.log('Waiting 60 seconds for application updates...')
    const timeout = setTimeout(() => {
      throw ERR_LEGACY(
        '[ LEGACY ] No longer booting app from HTML entrypoints\n  Developer Solution: pear run pear://runtime/documentation/migration'
      )
    }, 60_000)
    const stream = updates({ app: true }, (update) => {
      clearTimeout(timeout)
      if (update.updating) {
        console.log('Updating please wait...')
      } else if (update.updated) {
        console.log('Application update received')
        console.log(
          `pear://${update.version.fork}.${update.version.length}.${update.version.key}`
        )
        console.log('Rerun to open')
        stream.end()
      }
    })
    return new Promise((resolve) => global.Pear.teardown(resolve, Infinity))
  }

  // clear global handlers
  Bare.removeAllListeners('uncaughtException')
  Bare.removeAllListeners('unhandledRejection')

  // preserves uncaught exceptions (otherwise they become unhandled rejections)
  setImmediate(() => {
    const url = new URL(Pear.app.applink + entry + '.bundle')
    Module.load(url, bundle)
    setImmediate(() => {
      // stops replaying & relaying subscriber streams between clients
      if (Pear.constructor.CUTOVER === true) ipc.cutover()
    })
  })

  return new Promise((resolve) => global.Pear.teardown(resolve, Infinity))
}

function normalize(pathname) {
  if (pathname[0] === '/' && pathname[2] === ':')
    return path.normalize(pathname.slice(1))
  return path.normalize(pathname)
}
