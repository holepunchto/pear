'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const ENV = require('bare-env')
const { spawn } = require('bare-subprocess')
const { pathToFileURL } = require('url-file-url')
const { Readable } = require('streamx')
const { isMac, isWindows } = require('which-runtime')
const API = require('pear-api')
const constants = require('pear-api/constants')
const teardown = require('pear-api/teardown')
const parseLink = require('./lib/parse-link')
const {
  ERR_INVALID_APPLING,
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_INPUT
} = require('./errors')
const State = require('./state')


module.exports = async function run ({ ipc, args, cmdArgs, link, storage, detached, flags, appArgs, indices }) {
  const { drive, pathname } = parseLink(link)
  const entry = isWindows ? path.normalize(pathname.slice(1)) : pathname
  const { key } = drive
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = isPear === false && isFile === false
  if (key !== null && isPear === false) {
    throw ERR_INVALID_INPUT('Key must start with pear://')
  }

  let cwd = os.cwd()
  const originalCwd = cwd
  let dir = cwd
  let base = null
  if (key === null) {
    try {
      dir = fs.statSync(entry).isDirectory() ? entry : path.dirname(entry)
    } catch { /* ignore */ }
    base = project(dir, pathname, cwd)
    dir = base.dir
    if (dir !== cwd) {
      Bare.on('exit', () => os.chdir(originalCwd)) // TODO: remove this once Pear.shutdown is used to close
      teardown(() => os.chdir(originalCwd))
      os.chdir(dir)
      cwd = dir
    }
    if (isPath) {
      link = pathToFileURL(path.join(dir, base.entrypoint || '/')).pathname
    }
  }

  const stream = new Readable({ objectMode: true })
  if (detached) {
    const { wokeup, appling } = await ipc.detached({ key, link, storage, appdev: key === null ? dir : null })
    if (wokeup) {
      ipc.close().catch(console.error)
      return stream
    }

    args = args.filter((arg) => arg !== '--detached')
    const opts = { detached: true, stdio: 'ignore', cwd }

    if (!appling) {
      args.unshift('run', '--detach')
      spawn(constants.RUNTIME, args, opts).unref()
      ipc.close().catch(console.error)
      return stream
    }

    const applingApp = isMac ? appling.split('.app')[0] + '.app' : appling

    try {
      await fsp.stat(applingApp)
    } catch {
      ipc.close().catch(console.error)
      throw ERR_INVALID_APPLING('Appling does not exist')
    }
  
    if (isMac) spawn('open', [applingApp, '--args', ...args], opts).unref()
    else spawn(applingApp, args, opts).unref()

    ipc.close().catch(console.error)
    return stream
  }

  const { startId, host, id, hasUi, bundle, bail } = await ipc.start({ flags, env: ENV, dir, link, cwd, args: appArgs, cmdArgs })

  if (bail?.code === 'ERR_PERMISSION_REQUIRED' && !flags.detach) {
    throw new ERR_PERMISSION_REQUIRED('Permission required to run key', bail.info)
  }

  const state = new State({ flags, link, dir, cmdArgs, cwd })

  state.update({ host, id })

  if (state.error) {
    console.error(state.error)
    global.process?.exit(1) || global.Bare.exit(1)
  }

  await ipc.ready()
  const ipcConfig = await ipc.config()
  state.update({ config: ipcConfig })

  
  global.Pear = new API(ipc, state, { teardown })

  const protocol = new Module.Protocol({
    exists (url) {
      return Object.hasOwn(bundle.sources, url.href) || Object.hasOwn(bundle.assets, url.href)
    },
    read (url) {
      return bundle.sources[url.href]
    }
  })

   Module.load(new URL(bundle.entrypoint), {
    protocol,
    resolutions: bundle.resolutions
  })

  if (hasUi === false) return stream

  const spawnUI = Module.load(new URL(Pear.config.ui.provider + '/spawn.js'), {
    protocol,
    resolutions: bundle.resolutions
  })
  args.unshift('--start-id=' + startId)
  if (isPath) args[indices.args.link] = 'file://' + (base.entrypoint || '/')
  const on = {
    out (data) { stream.push({ tag: 'stdout', data }) },
    err (data) { stream.push({ tag: 'stderr', data }) },
    exit (code) {
      stream.push({ tag: 'exit', data: { code } })
      ipc.close()
    }
  }
  spawnUI({ args, indices, on })
  global.Pear.teardown(() => ipc.close())

  return stream
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
  if (parent === dir || parent.startsWith(cwd) === false) {
    const normalizedOrigin = !isWindows ? origin : path.normalize(origin.slice(1))
    const cwdIsOrigin = path.relative(cwd, normalizedOrigin).length === 0
    const condition = cwdIsOrigin ? `at "${cwd}"` : normalizedOrigin.includes(cwd) ? `from "${normalizedOrigin}" up to "${cwd}"` : `at "${normalizedOrigin}"`
    throw ERR_INVALID_INPUT(`A valid package.json file with pear field must exist ${condition}`)
  }
  return project(parent, origin, cwd)
}
