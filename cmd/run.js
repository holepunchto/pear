'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const path = require('bare-path')
const ENV = require('bare-env')
const { pathToFileURL } = require('url-file-url')
const { spawn: daemon } = require('bare-daemon')
const { isWindows } = require('which-runtime')
const API = require('pear-api')
const constants = require('pear-api/constants')
const teardown = require('pear-api/teardown')
const opwait = require('pear-api/opwait')
const plink = require('pear-api/link')
const {
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_PROJECT_DIR,
  ERR_INVALID_INPUT,
  ERR_LEGACY
} = require('pear-api/errors')
const State = require('pear-api/state')
const { outputter, permit, isTTY } = require('pear-api/terminal')
const Pre = require('../pre')

const output = outputter('run', {
  preio ({ from, output, index, fd }, { io }) {
    if (!io) return {}
    const std = fd === 1 ? 'stdout' : 'stderr'
    const pre = 'Pre-run [' + index + ':' + from + ':' + std + ']: '
    return pre + output
  },
  pre ({ from, output, index, success }, { quiet }) {
    if (quiet) return {}
    // only occurs when run from disk
    const pre = index > 0 ? 'Pre-run [' + index + ':' + from + ']: ' : 'Pre-run [' + from + ']: '
    const suffix = LOG.INF ? ' - ' + JSON.stringify(output.data) : ''
    if (success === false) return { success: false, message: output?.stack || output?.message || 'Unknown Pre Error' }
    return pre + output.tag + suffix
  },
  final: {} // hide "{tick} Success", not needed for run
})

module.exports = (ipc) => async function run (cmd, devrun = false) {
  const { flags } = cmd
  try {
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

    if (onDisk === false && isPear === false) throw ERR_INVALID_INPUT('Key must start with pear://')

    const cwd = os.cwd()
    let dir = cwd
    let pkg = null

    if (onDisk) {
      dir = normalize(pathname)
      const base = { cwd, dir, entrypoint: '/' }
      pkg = await State.localPkg(base) // may modify base.dir
      if (pkg === null) throw ERR_INVALID_PROJECT_DIR(`A valid package.json must exist (checked from "${dir}" to "${base.dir}")`)
      base.entrypoint = dir.slice(base.dir.length)

      dir = base.dir
      if (dir.length > 1 && dir.endsWith('/')) dir = dir.slice(0, -1)
      if (isPath) link = plink.normalize(pathToFileURL(path.join(dir, base.entrypoint || '/')).href) + search + hash
      if (flags.pre) {
        const pre = new Pre('run', base)
        pkg = await output({ ctrlTTY: false }, pre, { io: flags.preio, quiet: flags.prequiet })
      }
    }

    if (detached) {
      const { wokeup, appling } = await ipc.detached({ key, link, storage, appdev: onDisk ? dir : null, pkg })

      if (wokeup) return ipc.close().catch(console.error)
      args = args.filter((arg) => arg !== '--detached')
      const opts = { cwd }
      if (!appling) args.unshift('run', '--detach')
      else args.unshift('run', '--appling', appling)
      daemon(constants.RUNTIME, args, opts)
      return ipc.close().catch(console.error)
    }
    const stream = ipc.run({ flags, env: ENV, dir, link, cwd, args: appArgs, cmdArgs, pkg })
    const { startId, id, bundle, bail, success } = await opwait(stream)
    if (success === false) return
    if (bail?.code === 'ERR_PERMISSION_REQUIRED' && !flags.detach) {
      throw ERR_PERMISSION_REQUIRED('Permission required to run key', bail.info)
    }

    const state = new State({ startId, id, flags, link, dir, cmdArgs, cwd })

    if (state.error) throw state.error

    await ipc.ready()
    const config = await ipc.config()
    state.update({ config })

    global.Pear = new API(ipc, state, { teardown })

    const protocol = new Module.Protocol({
      exists (url) {
        if (url.href.endsWith('.bare') || url.href.endsWith('.node')) return true
        return Object.hasOwn(bundle.sources, url.href) || Object.hasOwn(bundle.assets, url.href)
      },
      read (url) {
        return bundle.sources[url.href]
      }
    })

    if (bundle.entrypoint.endsWith('.html')) {
      throw ERR_LEGACY('[ LEGACY ] No longer booting app from HTML entrypoints\n  Solution: pear run pear://runtime/documentation/migration')
    }

    // clear global handlers
    Bare.removeAllListeners('uncaughtException')
    Bare.removeAllListeners('unhandledRejection')

    // preserves uncaught exceptions (otherwise they become unhandled rejections)
    setImmediate(() => {
      Module.load(new URL(bundle.entrypoint), {
        protocol,
        resolutions: bundle.resolutions
      })
    })

    return new Promise((resolve) => global.Pear.teardown(resolve))
  } catch (err) {
    if (err.code === 'ERR_PERMISSION_REQUIRED' && flags.ask && isTTY) {
      await permit(ipc, err.info, 'run')
    } else {
      throw err
    }
  }
}

function normalize (pathname) {
  if (isWindows) return path.normalize(pathname.slice(1))
  return pathname
}
