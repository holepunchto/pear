'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const ENV = require('bare-env')
const { pathToFileURL } = require('url-file-url')
const { spawn: daemon } = require('bare-daemon')
const { isWindows } = require('which-runtime')
const API = require('pear-api')
const constants = require('pear-api/constants')
const teardown = require('pear-api/teardown')
const plink = require('pear-api/link')
const {
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_PROJECT_DIR,
  ERR_INVALID_INPUT,
  ERR_LEGACY
} = require('pear-api/errors')
const State = require('pear-api/state')

module.exports = async function run ({ ipc, args, cmdArgs, link, storage, detached, flags, appArgs }) {
  const { drive, pathname, search, hash } = plink.parse(link)
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
    const startpoint = isWindows ? normalize(pathname) : pathname
    base = project(startpoint, startpoint)
    dir = base.dir
    if (dir.length > 1 && dir.endsWith('/')) dir = dir.slice(0, -1)
    if (isPath) link = pathToFileURL(path.join(dir, base.entrypoint || '/')) + search + hash
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

function project (dir, startpoint) {
  console.log('PROJECT', dir, startpoint)
  try {
    if (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).pear) {
      return { dir, startpoint, entrypoint: startpoint.slice(dir.length) }
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EISDIR' && err.code !== 'ENOTDIR') throw err
  }
  const parent = path.dirname(dir)
  if (parent === dir) {
    throw ERR_INVALID_PROJECT_DIR(`A valid package.json file with pear field must exist (checked from "${startpoint}" to "${dir}")`)
  }
  return project(parent, startpoint)
}

function normalize (pathname) {
  if (!isWindows) return pathname
  return path.normalize(pathname.slice(1))
}
