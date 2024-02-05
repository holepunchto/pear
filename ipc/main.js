'use strict'
const electron = require('electron')
const gui = require('../lib/gui')
const Context = require('../ctx/shared')
const Crank = require('./crank')
const { constructor: AGF } = async function * () {}
const constants = require('../lib/constants')

const errors = {
  ERR_NO_HANDLER: (name) => `options for "${name}" has no corresponding handler`,
  ERR_RESERVED: (name) => `handlers cannot be named "${name}". Reserved word.`,
  ERR_INTRA_CONFLICT: (name) => `intra option for "${name}" conflicts with manual, once, sync, invoked options and async generator handlers`,
  ERR_SYNC_CONFLICT: (name) => `sync option for "${name}" conflicts with async generator handler`,
  ERR_INVOKE_CONFLICT: (name) => `invoked option for "${name}" conflicts with sync option and async generator handler`
}

module.exports = class IPC {
  teardowns = []
  channels = []
  id = null
  handlers = null
  app = null
  constructor (ctx, client) {
    this.sidecar = new Crank(client)
    this.ctx = ctx
  }

  setup (id) {
    if (this.id !== null) return
    this.id = id
    this.handlers = new Handlers(this.id, this.app, this)
  }

  error (code, ...args) {
    return new Error(`Internal IPC Platform Developer Error: ${errors[code](...args)}`)
  }

  address () {
    return this.sidecar.address()
  }

  identify () {
    return this.sidecar.identify()
  }

  wakeup () {
    let link = this.ctx.flags.run || this.ctx.flags.link
    if (!link) return false
    if (link.startsWith('pear:') === false && link.startsWith('punch:') === false) link = 'pear://' + link
    const devlink = link.startsWith('pear://dev') || link.startsWith('pear:dev') || link.startsWith('punch//:dev') || link.startsWith('punch:dev')
    const appdev = devlink && this.ctx.cwd
    return this.sidecar.wakeup(link, this.ctx.storage, appdev)
  }

  async start (app, ...args) {
    this.app = app
    electron.ipcMain.on('id', async (event) => {
      if (this.id) {
        event.returnValue = this.id
        return this.id
      }
      const { id } = await this.app.starting
      event.returnValue = id
      return id
    })
    return await this.sidecar.start(...args)
  }

  async notify (params) {
    await this.sidecar.notify({ ...params, args: serializeArgs(params.args) })
  }

  async request (params, opts) {
    const result = await this.sidecar.request({ ...params, args: serializeArgs(params.args) }, opts)
    return result
  }

  async * iterable (params) {
    yield * this.sidecar.iterable(params.channel, params)
  }

  unloading () {
    return this.sidecar.unloading()
  }

  async close () {
    for (const channel of Object.values(this.channels)) {
      electron.ipcMain.removeAllListeners(channel)
    }
    return this.sidecar.close()
  }
}

class Handlers {
  constructor (id, app, ipc) {
    this.id = id
    this.app = app
    this.sidecar = ipc.sidecar
    this.ctx = ipc.ctx
    this.ipc = ipc
    this.#engine()
    this.#gui()
    this.#app()
    if (constants.INTERNAL_UNSAFE) this.#internal()
  }

  #handler (domain) {
    const handler = new Handler(domain, this)
    return {
      front: (...args) => handler.front(...args),
      side: (...args) => handler.side(...args)
    }
  }

  #engine () {
    const { side } = this.#handler('engine')

    side({ name: 'resolve', sync: true })

    side({ name: 'platformResolve' })

    side({ name: 'notifications', iterable: true, eager: true })

    side({ name: 'restart' })

    side({ name: 'changelog' })
  }

  #gui () {
    const { front } = this.#handler('gui')

    front({ name: 'ctrl', sync: true }, async function ctrl ({ sidecar, sender, ua, ctx }, type, entry, options = {}, openOptions) {
      const parentId = sender
      ;[entry] = entry.split('+')
      const sessname = null

      const args = ['--run', entry]

      const appkin = entry.startsWith('pear:') || entry.startsWith('punch:') // punch: is legacy
        ? sidecar.start(args).then(({ host, id }) => new Context({ sidecar: host, id, args, env: ctx?.env, cwd: ctx?.cwd, config: Context.configFrom(ctx) }))
        : null
      if (appkin) entry = '/'
      const instance = await gui.ctrl(type, entry, { parentId, ctx, ua, sessname, appkin }, options, openOptions)
      return instance.id
    })

    front({ name: 'id', sync: true }, function id ({ sender }) { return sender })

    front({ name: 'closing', sync: true }, function closing (info, id) { return !!(gui.get(id)?.closing) })

    front({ name: 'parentId', sync: true }, function parentId ({ sender }) {
      const instance = gui.get(sender)
      return instance.parentId
    })

    front({ name: 'open' }, function open (info, id, options) {
      return gui.get(id).open(options)
    })

    front({ name: 'close' }, function close (info, id) { return gui.get(id).close() })

    front({ name: 'show' }, function show (info, id) { return gui.get(id).show() })

    front({ name: 'hide' }, function hide (info, id) { return gui.get(id).hide() })

    front({ name: 'minimize' }, function minimize (info, id) { return gui.get(id).minimize() })

    front({ name: 'maximize' }, function maximize (info, id) { return gui.get(id).maximize() })

    front({ name: 'fullscreen' }, function fullscreen (info, id) { return gui.get(id).fullscreen() })

    front({ name: 'restore' }, function restore (info, id) { return gui.get(id).restore() })

    front({ name: 'focus' }, function focus (info, id, opts) { return gui.get(id).focus(opts) })

    front({ name: 'blur' }, function blur (info, id) { return gui.get(id).blur() })

    front({ name: 'getMediaSourceId' }, function getMediaSourceId (info, id) { return gui.get(id).getMediaSourceId() })

    front({ name: 'dimensions' }, function dimensions (info, id, opts) { return gui.get(id).dimensions(opts) })

    front({ name: 'isVisible' }, async function isVisible (info, id) { return gui.get(id).isVisible() })

    front({ name: 'isClosed' }, function isClosed (info, id) { return (gui.has(id)) ? gui.get(id).isClosed() : true })

    front({ name: 'isMinimized' }, function isMinimized (info, id) { return gui.get(id).isMinimized() })

    front({ name: 'isMaximized' }, function isMaximized (info, id) { return gui.get(id).isMaximized() })

    front({ name: 'isFullscreen' }, function isFullscreen (info, id) { return gui.get(id).isFullscreen() })

    front({ name: 'parent' }, function parent (info, act, id, ...args) {
      const instance = gui.get(id)
      if (!instance) throw new Error(`Could not find parent with id "${id}" to perform action "${act}"!`)
      if (act === 'focus') return instance.focus(...args)
      if (act === 'blur') return instance.blur()
      if (act === 'show') return instance.show()
      if (act === 'hide') return instance.hide()
      if (act === 'dimensions') return instance.dimensions(...args)
      if (act === 'getMediaSourceId') return instance.getMediaSourceId()
      if (act === 'isClosed') return instance.isClosed()
      if (act === 'isVisible') return instance.isVisible()
      if (act === 'isMinimized') return instance.isMinimized()
      if (act === 'isMaximized') return instance.isMaximized()
      if (act === 'isFullscreen') return instance.isFullscreen()
    })

    front({ name: 'unloading' }, async function unloading (info, id) {
      const action = await gui.get(id).unloading()
      return action
    })

    front({ name: 'completeUnload' }, async function completeUnload (info, id, action) {
      const instance = gui.get(id)
      if (!instance) return
      instance.completeUnload(action)
    })

    front({ name: 'attachMainView' }, async function attachMainView (info, id) { gui.get(id).attachMainView() })

    front({ name: 'detachMainView' }, async function detachMainView (info, id) { gui.get(id).detachMainView() })

    front({ name: 'afterViewLoaded' }, async function afterViewLoaded (info, id) {
      return gui.get(id).afterViewLoaded()
    })

    front({ name: 'chrome' }, async function chrome ({ ctx }, name) {
      return gui.chrome(name)
    })
  }

  #app () {
    const { front, side } = this.#handler('app')

    front({ name: 'getMediaAccessStatus' }, function getMediaAccessStatus (app, mediaType) {
      return electron.systemPreferences.getMediaAccessStatus(mediaType)
    })

    front({ name: 'askForMediaAccess' }, async function askForMediaAccess ({ top }, mediaType) {
      if (mediaType === 'screen') return !!(await top.getMediaSourceId())
      return electron.systemPreferences.askForMediaAccess(mediaType)
    })

    front({ name: 'desktopSources' }, async function desktopSources ({ ctx }, options) {
      return electron.desktopCapturer.getSources(options)
    })

    front({ name: 'quit', sync: true }, function quit ({ app }, code) {
      process.exitCode = code
      app.quit()
    })

    side({ name: 'reconfig' })

    side({ name: 'config' })

    side({ name: 'options' })

    side({ name: 'checkpoint' })

    side({ name: 'setPreference' })

    side({ name: 'getPreference' })

    side({ name: 'iteratePreferences', iterable: true, finite: true })

    side({ name: 'preferencesUpdates', iterable: true })

    side({ name: 'messages', iterable: true })

    side({ name: 'message' })

    side({ name: 'versions' })

    side({ name: 'warming', iterable: true })

    side({ name: 'restart' })

    side({ name: 'createReport' })

    front({ name: 'reports' }, async function * reports ({ sidecar, ctx }) {
      try {
        for await (const report of sidecar.iterable(`${ctx.id}:app:reports`, {}, { eager: true })) {
          gui.reportMode(ctx)
          yield report
        }
      } catch (err) {
        console.error('report error', err)
      }
    })
  }

  #internal () {
    const { side } = this.#handler('internal')
    side({ name: 'bundledb' })
  }
}

class Handler {
  constructor (domain, { id, app, sidecar, ctx }) {
    this.domain = domain
    this.id = id
    this.app = app
    this.sidecar = sidecar
    this.ctx = ctx
  }

  #ipceh (fn) { // ipc error handler
    return async (event, ...args) => {
      try {
        return await fn(event, ...args)
      } catch (err) {
        if (err.code === 'E_HALTED' || err.code === 'E_SESSION_CLOSED' || err.remote?.code === 'E_REMOTE_CLOSED') return
        console.error('Platform IPC (main)', err)
      }
    }
  }

  front ({ name, sync = false, finite = false } = {}, fn) {
    if (!fn) {
      throw new Error(`Internal Platform Developer Error: IPC front method "${name}" needs a handler`)
    }
    if (name !== fn.name) {
      throw new Error(`Internal Platform Developer Error: IPC front method name should match handler function name ("${name}" vs "${fn.name})`)
    }
    const iterable = fn instanceof AGF
    const { id, domain } = this
    const channel = `${id}:${domain}:${name}`
    if (sync) {
      electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
        const sender = event.sender.id
        const ua = event.sender.getUserAgent()
        event.returnValue = await fn({ ...this, sender, ua, channel, args }, ...args)
      }))
      return
    }

    if (iterable) {
      if (finite) {
        electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
          const sender = event.sender.id
          const ua = event.sender.getUserAgent()
          const iter = fn({ ...this, sender, ua, channel, args }, ...args)
          try {
            for await (const value of iter) event.reply(channel, { value })
          } finally {
            event.reply(channel, null)
          }
        }))
        return
      }
      const renderClients = new Set()
      let iter = null
      let broadcasting = false
      electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
        const sender = event.sender.id
        const ua = event.sender.getUserAgent()
        if (iter === null) iter = fn({ ...this, sender, ua, channel, args })
        renderClients.add(event)
        if (broadcasting) return
        broadcasting = true
        try {
          do {
            const item = await iter.next()
            for (const event of renderClients) {
              if (item.done) event.reply(channel, null)
              else event.reply(channel, { value: item.value })
            }
            if (item.done) break
          } while (true)
        } finally {
          renderClients.clear()
        }
      }))
      return
    }
    electron.ipcMain.handle(channel, this.#ipceh(async (event, ...args) => {
      const sender = event.sender.id
      const ua = event.sender.getUserAgent()
      const result = await fn({ ...this, sender, ua, channel, args }, ...args)
      return result
    }))
  }

  side ({ name, sync = false, iterable = false, finite = false, eager = false } = {}) {
    const { domain, id, sidecar } = this
    const channel = `${id}:${domain}:${name}`

    if (sync) {
      electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
        const sender = event.sender.id
        const ua = event.sender.getUserAgent()
        event.returnValue = await sidecar.request({ id, sender, ua, channel, args: serializeArgs(args) })
      }))
      return
    }

    if (iterable) {
      if (finite) {
        electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
          const sender = event.sender.id
          const ua = event.sender.getUserAgent()
          const iter = sidecar.iterable(channel, { id, sender, ua, channel, args: serializeArgs(args) }, { eager })
          try {
            for await (const value of iter) event.reply(channel, { value })
          } finally {
            event.reply(channel, null)
          }
        }))
        return
      }
      const renderClients = new Set()
      let iter = null
      let broadcasting = false

      electron.ipcMain.on(channel, this.#ipceh(async (event, ...args) => {
        const sender = event.sender.id
        const ua = event.sender.getUserAgent()
        if (iter === null) iter = sidecar.iterable(channel, { id, sender, ua, channel, args: serializeArgs(args) }, { eager })
        renderClients.add(event)
        if (broadcasting) return
        broadcasting = true
        try {
          do {
            const item = await iter.next()
            for (const event of renderClients) {
              if (item.done) event.reply(channel, null)
              else event.reply(channel, { value: item.value })
            }
            if (item.done) break
          } while (true)
        } finally {
          renderClients.clear()
        }
      }))
      return
    }
    electron.ipcMain.handle(channel, this.#ipceh(async (event, ...args) => {
      const sender = event.sender.id
      const ua = event.sender.getUserAgent()
      return await sidecar.request({ id, sender, ua, channel, args: serializeArgs(args) })
    }))
  }
}

function serializeArgs (args = []) {
  try {
    return JSON.stringify(args)
  } catch (err) {
    console.error('Pear Platform: argument serialization error', err)
  }
}
