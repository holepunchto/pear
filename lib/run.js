'use strict'
const { isBare, isMac } = require('which-runtime')
const Module = isBare ? require('bare-module') : null
const os = isBare ? require('bare-os') : require('os')
const fsp = isBare ? require('bare-fs/promises') : require('fs/promises')
const ENV = isBare ? require('bare-env') : process.env
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { Readable } = require('streamx')
const constants = require('../lib/constants')
const Context = require('../ctx/shared')
const API = isBare ? require('../lib/api') : null

module.exports = async function run ({ rpc, args, key, storage, detached, dir }) {
  const stream = new Readable({ objectMode: true })
  try {
    if (detached) {
      const { wokeup, appling } = await rpc.detached({ key, storage, appdev: key === null && dir })
      if (wokeup) return stream

      args = args.filter((arg) => arg !== '--detached')
      const opts = { detached: true }

      if (!appling) {
        args.unshift('run', '--no-ask-trust')
        spawn(constants.RUNTIME, args, opts).unref()
        return stream
      }

      const applingApp = isMac ? appling.split('.app')[0] + '.app' : appling

      try {
        await fsp.stat(applingApp)
      } catch {
        throw new Error('Appling does not exist')
      }

      if (args[0].startsWith('pear://runtime')) {
        args = [constants.BOOT, '--appling', appling, '--run', ...args]
        spawn(constants.DESKTOP_RUNTIME, args).unref()
      } else {
        if (isMac) spawn('open', [applingApp, '--args', ...args], opts).unref()
        else spawn(applingApp, args, opts).unref()
      }

      return stream
    }

    const cwd = isBare ? os.cwd() : global.process.cwd()
    args.unshift('--run')

    const { startId, host, id, type = 'desktop', bundle } = await rpc.start({ argv: args, env: ENV, cwd })

    if (type === 'terminal') {
      const ctx = new Context({ argv: args })

      ctx.update({ host, id })

      if (ctx.error) {
        console.error(ctx.error)
        global.process?.exit(1) || global.Bare.exit(1)
      }

      await rpc.ready()
      ctx.update({ config: await rpc.config() })

      const pear = new API(rpc, ctx)
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
    if (type === 'desktop') {
      args = [constants.BOOT, ...args]
      const child = spawn(constants.DESKTOP_RUNTIME, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        ...{ env: { ...ENV, NODE_PRESERVE_SYMLINKS: 1 } }
      })
      child.once('exit', (code) => {
        stream.push({ tag: 'exit', data: { code } })
        stream.destroy()
      })
      child.stdout.on('data', (data) => { stream.push({ tag: 'stdout', data }) })
      child.stderr.on('data', (data) => {
        const str = data.toString()
        const ignore = str.indexOf('DevTools listening on ws://') > -1 ||
          str.indexOf('NSApplicationDelegate.applicationSupportsSecureRestorableState') > -1 ||
          str.indexOf('devtools://devtools/bundled/panels/elements/elements.js') > -1 ||
          str.indexOf('sysctlbyname for kern.hv_vmm_present failed with status -1') > -1
        if (ignore) return
        stream.push({ tag: 'stderr', data })
      })
    }

    return stream
  } finally {
    if (global.Pear) global.Pear.teardown(() => rpc.close())
    else rpc.close()
    if (detached || global.Pear) stream.destroy()
  }
}
