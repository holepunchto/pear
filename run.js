'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const ENV = require('bare-env')
const { spawn: daemon } = require('bare-daemon')
const { isWindows } = require('which-runtime')
const API = require('pear-api')
const constants = require('pear-api/constants')
const teardown = require('pear-api/teardown')
const parseLink = require('pear-api/parse-link')
const {
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_PROJECT_DIR,
  ERR_INVALID_INPUT,
  ERR_LEGACY
} = require('pear-api/errors')
const State = require('pear-api/state')

module.exports = async function run ({ ipc, args, cmdArgs, link, storage, detached, flags, appArgs }) {
  const { drive, pathname } = parseLink(link)
  const entry = isWindows ? path.normalize(pathname.slice(1)) : pathname
  const { key } = drive
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = isPear === false && isFile === false
  if (key !== null && isPear === false) {
    throw ERR_INVALID_INPUT('Key must start with pear://')
  }

  const cwd = os.cwd()
  let dir = cwd
  let base = null
  if (key === null) {
    try {
      dir = fs.statSync(entry).isDirectory() ? entry : path.dirname(entry)
    } catch { /* ignore */ }
    base = project(dir, pathname, cwd)
    dir = base.dir
    if (isPath) {
      link = path.join(dir, base.entrypoint || '/')
    }
  }

  if (detached) {
    const { wokeup, appling } = await ipc.detached({ key, link, storage, appdev: key === null ? dir : null })
    if (wokeup) return ipc.close().catch(console.error)
    args = args.filter((arg) => arg !== '--detached')
    const opts = { cwd }
    if (!appling) args.unshift('run', '--detach')
    else args.unshift('run', '--appling', appling)

    daemon(constants.RUNTIME, args, opts)
    return ipc.close().catch(console.error)
  }

  const { startId, id, bundle, bail } = await ipc.start({ flags, env: ENV, dir, link, cwd, args: appArgs, cmdArgs })

  if (bail?.code === 'ERR_PERMISSION_REQUIRED' && !flags.detach) {
    throw new ERR_PERMISSION_REQUIRED('Permission required to run key', bail.info)
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
}

function project (dir, origin, cwd) {
  try {
    if (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).pear) {
      return { dir, origin, entrypoint: isWindows ? path.normalize(origin.slice(1)).slice(dir.length) : origin.slice(dir.length) }
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EISDIR' && err.code !== 'ENOTDIR') throw err
  }
  const parent = path.dirname(dir)
  if (parent === dir || path.resolve(dir) === path.resolve(parent)) {
    throw ERR_INVALID_PROJECT_DIR('A valid package.json file with pear field must exist in the project')
  }
  return project(parent, origin, cwd)
}
