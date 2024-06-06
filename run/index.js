'use strict'
const Module = require('bare-module')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const ENV = require('bare-env')
const { spawn } = require('bare-subprocess')
const { Readable } = require('streamx')
const { fileURLToPath } = require('url-file-url')
const { isMac } = require('which-runtime')
const constants = require('../constants')
const State = require('../state')
const API = require('../lib/api')
const {
  ERR_INVALID_APPLING,
  ERR_PERMISSION_REQUIRED,
  ERR_INVALID_INPUT
} = require('../errors')
const parseLink = require('./parse-link')
const teardown = require('../lib/teardown')

module.exports = async function run ({ ipc, args, cmdArgs, link, storage, detached, flags, appArgs }) {
  let dir = null
  let rel = null
  let key = null

  key = parseLink(link).key

  if (key !== null && link.startsWith('pear://') === false) {
    throw ERR_INVALID_INPUT('Key must start with pear://')
  }

  const cwd = os.cwd()
  dir = key === null ? (link.startsWith('file:') ? fileURLToPath(link) : link) : cwd
  if (path.isAbsolute(dir) === false) {
    rel = dir
    dir = path.resolve(cwd, dir)
  }

  if (dir !== cwd) {
    Bare.on('exit', () => os.chdir(cwd)) // TODO: remove this once Pear.shutdown is used to close
    teardown(() => os.chdir(cwd))
    os.chdir(dir)
  }

  if (key === null) {
    try {
      JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))
    } catch (err) {
      throw ERR_INVALID_INPUT(`A valid package.json file must exist at: "${dir}"`, { showUsage: false })
    }
  }

  const stream = new Readable({ objectMode: true })
  if (detached) {
    const { wokeup, appling } = await ipc.detached({ key, storage, appdev: key === null && dir })
    if (wokeup) {
      ipc.close().catch(console.error)
      return stream
    }

    args = args.filter((arg) => arg !== '--detached')
    const opts = { detached: true, stdio: 'ignore' }

    if (!appling) {
      args.unshift('run', '--detach')
      if (rel) {
        const ix = args.indexOf(rel)
        if (ix > -1) args[ix] = dir
      }
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
      args = [constants.BOOT, '--appling', appling, '--run', ...args]
      spawn(constants.DESKTOP_RUNTIME, args).unref()
    } else {
      if (isMac) spawn('open', [applingApp, '--args', ...args], opts).unref()
      else spawn(applingApp, args, opts).unref()
    }
    ipc.close().catch(console.error)
    return stream
  }
  const { startId, host, id, type = 'desktop', bundle, bail } = await ipc.start({ flags, env: ENV, dir, link, args: appArgs, cmdArgs })
  if (bail && args.indexOf('--detach') === -1) {
    const err = ERR_PERMISSION_REQUIRED('Permission required to run key')
    err.key = key
    throw err
  }

  if (type === 'terminal') {
    const state = new State({ flags, link, dir, cmdArgs })

    state.update({ host, id })

    if (state.error) {
      console.error(state.error)
      global.process?.exit(1) || global.Bare.exit(1)
    }

    await ipc.ready()
    state.update({ config: await ipc.config() })

    const pear = new API(ipc, state)
    global.Pear = pear

    const protocol = new Module.Protocol({
      exists (url) {
        return Object.hasOwn(bundle.sources, url.href)
      },
      read (url) {
        return bundle.sources[url.href]
      }
    })

    Module.load(new URL(bundle.entrypoint), {
      protocol,
      resolutions: bundle.resolutions
    })

    return stream
  }

  args.unshift('--start-id=' + startId)
  const detach = args.includes('--detach')
  if (type === 'desktop') {
    args = [constants.BOOT, ...args]
    const stdio = detach ? 'ignore' : ['inherit', 'pipe', 'pipe']
    const child = spawn(constants.DESKTOP_RUNTIME, args, {
      stdio,
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
              str.indexOf('devtools://devtools/bundled/panels/elements/elements.js') > -1 ||
              str.indexOf('sysctlbyname for kern.hv_vmm_present failed with status -1') > -1 ||
              str.indexOf('libva error: vaGetDriverNameByIndex() failed') > -1 ||
              str.indexOf('GetVSyncParametersIfAvailable() failed') > -1
        if (ignore) return
        stream.push({ tag: 'stderr', data })
      })
    }
  }

  if (global.Pear) global.Pear.teardown(() => ipc.close())

  return stream
}
