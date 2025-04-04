'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const ENV = require('bare-env')
const { spawn } = require('bare-subprocess')
const { Readable } = require('streamx')
const { isMac, isWindows, isLinux } = require('which-runtime')
const constants = require('./constants')
const State = require('./state')
const API = require('./lib/api')
const {
  ERR_INVALID_APPLING,
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_INPUT
} = require('./errors')
const parseLink = require('./lib/parse-link')
const teardown = require('./lib/teardown')

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
      link = path.join(dir, base.entrypoint || '/')
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

    if (link.startsWith('pear://runtime')) {
      if ((isLinux || isWindows) && !flags.sandbox) args.splice(indices.args.link, 0, '--no-sandbox')
      args = [constants.BOOT, '--appling', appling, '--run', ...args]
      spawn(constants.DESKTOP_RUNTIME, args, opts).unref()
    } else {
      if (isMac) spawn('open', [applingApp, '--args', ...args], opts).unref()
      else spawn(applingApp, args, opts).unref()
    }
    ipc.close().catch(console.error)
    return stream
  }

  const { startId, host, id, type = 'desktop', bundle, bail, app } = await ipc.start({ flags, env: ENV, dir, link, cwd, args: appArgs, cmdArgs })

  if (bail?.code === 'ERR_PERMISSION_REQUIRED' && !flags.detach) {
    throw new ERR_PERMISSION_REQUIRED('Permission required to run key', bail.info)
  }

  if (type === 'terminal') {
    const state = new State({ flags, link, dir, cmdArgs, cwd })

    state.update({ host, id, type })

    if (state.error) {
      console.error(state.error)
      global.process?.exit(1) || global.Bare.exit(1)
    }

    await ipc.ready()
    const ipcConfig = await ipc.config()
    state.update({ config: ipcConfig })

    global.Pear = new API(ipc, state)

    const protocol = new Module.Protocol({
      exists (url) {
        if (url.href.endsWith('.bare') || url.href.endsWith('.node')) return true
        return Object.hasOwn(bundle.sources, url.href) || Object.hasOwn(bundle.assets, url.href)
      },
      read (url) {
        return bundle.sources[url.href]
      }
    })

    // clear global handlers
    Bare.removeAllListeners('uncaughtException')
    Bare.removeAllListeners('unhandledRejection')

    // preserves uncaught exception (otherwise it becomes uncaught rejection)
    setImmediate(() => {
      Module.load(new URL(bundle.entrypoint), {
        protocol,
        resolutions: bundle.resolutions
      })
    })

    return stream
  }

  args.unshift('--start-id=' + startId)
  const detach = args.includes('--detach')
  if (type === 'desktop') {
    if (isPath) args[indices.args.link] = 'file://' + (base.entrypoint || '/')
    args[indices.args.link] = args[indices.args.link].replace('://', '_||') // for Windows
    if ((isLinux || isWindows) && !flags.sandbox) args.splice(indices.args.link, 0, '--no-sandbox')
    if (app?.name) args.splice(indices.args.link, 0, '--app-name', app.name)
    args = [constants.BOOT, ...args]
    const stdio = detach ? 'ignore' : ['ignore', 'pipe', 'pipe']
    const child = spawn(constants.DESKTOP_RUNTIME, args, {
      stdio,
      cwd,
      ...{ env: { ...ENV, NODE_PRESERVE_SYMLINKS: 1 } }
    })
    child.once('exit', (code) => {
      stream.push({ tag: 'exit', data: { code } })
      ipc.close()
    })
    if (!detach) {
      child.stdout.on('data', (data) => { stream.push({ tag: 'stdout', data }) })
      child.stderr.on('data', (data) => {
        const str = data.toString()
        const ignore = str.indexOf('DevTools listening on ws://') > -1 ||
              str.indexOf('NSApplicationDelegate.applicationSupportsSecureRestorableState') > -1 ||
              str.indexOf('", source: devtools://devtools/') > -1 ||
              str.indexOf('sysctlbyname for kern.hv_vmm_present failed with status -1') > -1 ||
              str.indexOf('dev.i915.perf_stream_paranoid=0') > -1 ||
              str.indexOf('libva error: vaGetDriverNameByIndex() failed') > -1 ||
              str.indexOf('GetVSyncParametersIfAvailable() failed') > -1 ||
              (str.indexOf(':ERROR:') > -1 && /:ERROR:.+cache/.test(str))
        if (ignore) return
        stream.push({ tag: 'stderr', data })
      })
    }
  }

  if (global.Pear) global.Pear.teardown(() => ipc.close())

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
