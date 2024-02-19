'use strict'
const { isBare } = require('which-runtime')
const EventEmitter = isBare ? require('bare-events') : require('events')
const Iambus = require('iambus')

const config = global[Symbol.for('pear.config')] || {}

const ipc = createIpc(config)

const key = config.alias || config.key?.z32 || 'dev'

const storage = {
  path () {
    console.error('🚨 app.storage.path() is legacy. Replace with app.config.storage. Review for removal from platform ~ March 2023')
    return config.storage
  }
}

const message = (msg) => ipc.app.message(msg)

const messages = (pattern = {}, listener) => {
  if (typeof pattern === 'function') {
    listener = pattern
    pattern = {}
  }
  const subscriber = ipc.app.messages(pattern)
  if (typeof listener === 'function') subscriber.on('data', listener)
  return subscriber
}

const updates = (listener) => messages({ type: 'pear/updates' }, listener)

const checkpoint = (state) => {
  config.checkpoint = state
  return ipc.app.checkpoint(state)
}

const teardown = (fn) => {
  global[Symbol.for('pear.unloading')] = global[Symbol.for('pear.unloading')].then(fn)
}

const hooks = {
  suspend (fn) {
    console.error('🚨 app.hooks.suspend is legacy. Replace with app.teardown. Review for removal from platform ~ March 2023')
    if (typeof fn !== 'function') throw Error('Pear: app.hooks.suspend(fn) - provide a listener function')
    global[Symbol.for('pear.unloading')] = global[Symbol.for('pear.unloading')].then(fn)
  }
}

const preferences = Object.assign(function preferences () {
  return ipc.app.preferencesUpdates()
}, {
  set (key, value) {
    return ipc.app.setPreference(key, value)
  },

  get (key) {
    return ipc.app.getPreference(key)
  },

  del (key) {
    return ipc.app.setPreference(key, null)
  },

  async * list () {
    yield * ipc.app.iteratePreferences()
  }
})

const media = {
  status: {
    async microphone () { return ipc.app.getMediaAccessStatus('microphone') },
    async camera () { return ipc.app.getMediaAccessStatus('camera') },
    async screen () { return ipc.app.getMediaAccessStatus('screen') }
  },
  access: {
    async microphone () { return ipc.app.askForMediaAccess('microphone') },
    async camera () { return ipc.app.askForMediaAccess('camera') },
    async screen () { return ipc.app.askForMediaAccess('screen') }
  },
  desktopSources (options) {
    return ipc.app.desktopSources(options)
  }
}

async function versions () {
  return ipc.app.versions()
}

async function restart (opts = {}) {
  return ipc.app.restart(opts)
}

const kGuiCtrl = Symbol('gui:ctrl')

class Parent extends EventEmitter {
  #id
  constructor (id) {
    super()
    this.#id = id
    ipc.gui.intra.events.on('send', (e, ...args) => {
      this.emit('message', ...args)
    })
  }

  send (...args) { return ipc.gui.intra.send(this.#id, ...args) }
  focus (opts) { return ipc.gui.parent('focus', this.#id, opts) }
  blur () { return ipc.gui.parent('blur', this.#id) }
  show () { return ipc.gui.parent('show', this.#id) }
  hide () { return ipc.gui.parent('hide', this.#id) }
  minimize () { return ipc.gui.parent('minimize', this.#id) }
  maximize () { return ipc.gui.parent('maximize', this.#id) }
  fullscreen () { return ipc.gui.parent('fullscreen', this.#id) }
  restore () { return ipc.gui.parent('restore', this.#id) }
  dimensions (opts = null) { return ipc.gui.parent('dimensions', this.#id, opts) }
  getMediaSourceId () { return ipc.gui.parent('getMediaSourceId', this.#id) }
  isVisible () { return ipc.gui.parent('isVisible', this.#id) }
  isMinimized () { return ipc.gui.parent('isMinimized', this.#id) }
  isMaximized () { return ipc.gui.parent('isMaximized', this.#id) }
  isFullscreen () { return ipc.gui.parent('isFullscreen', this.#id) }
  isClosed () { return ipc.gui.parent('isClosed', this.#id) }
}

class Self {
  #id
  constructor (id) { this.#id = id }
  focus (opts) { return ipc.gui.focus(this.#id, opts) }
  blur () { return ipc.gui.blur(this.#id) }
  show () { return ipc.gui.show(this.#id) }
  hide () { return ipc.gui.hide(this.#id) }
  minimize () { return ipc.gui.minimize(this.#id) }
  maximize () { return ipc.gui.maximize(this.#id) }
  fullscreen () { return ipc.gui.fullscreen(this.#id) }
  restore () { return ipc.gui.restore(this.#id) }
  close () { return ipc.gui.close(this.#id) }
  getMediaSourceId () { return ipc.gui.getMediaSourceId(this.#id) }
  dimensions (opts = null) { return ipc.gui.dimensions(this.#id, opts) }
  isVisible () { return ipc.gui.isVisible(this.#id) }
  isMinimized () { return ipc.gui.isMinimized(this.#id) }
  isMaximized () { return ipc.gui.isMaximized(this.#id) }
  isFullscreen () { return ipc.gui.isFullscreen(this.#id) }
}

class GuiCtrl extends EventEmitter {
  #listener = null

  static get parent () {
    Object.defineProperty(this, 'parent', { value: new Parent(ipc.gui.parentId()) })
    return this.parent
  }

  static get self () {
    Object.defineProperty(this, 'self', { value: new Self(ipc.gui.id()) })
    return this.self
  }

  constructor (entry, at, options = at) {
    super()
    if (options === at) {
      if (typeof at === 'string') options = { at }
    }
    if (!entry) throw new Error(`No path provided, cannot open ${this.constructor[kGuiCtrl]}`)
    this.entry = entry
    this.options = options
    this.id = null
  }

  #rxtx () {
    this.#listener = (e, ...args) => this.emit('message', ...args)
    ipc.gui.intra.events.on('send', this.#listener)
  }

  #unrxtx () {
    if (this.#listener === null) return
    ipc.gui.intra.events.removeListener('send', this.#listener)
    this.#listener = null
  }

  async open (opts) {
    if (this.id === null) {
      await new Promise(setImmediate) // needed for windows/views opening on app load
      this.#rxtx()
      this.id = ipc.gui.ctrl(this.constructor[kGuiCtrl], this.entry, this.options, opts)
      return true
    }
    return await ipc.gui.open(this.id)
  }

  async close () {
    const result = await ipc.gui.close(this.id)
    this.#unrxtx()
    this.id = null
    return result
  }

  show () { return ipc.gui.show(this.id) }
  hide () { return ipc.gui.hide(this.id) }
  focus (opts) { return ipc.gui.focus(this.id, opts) }
  blur () { return ipc.gui.blur(this.id) }
  send (...args) { return ipc.gui.intra.send(this.id, ...args) }
  getMediaSourceId () { return ipc.gui.getMediaSourceId(this.id) }
  dimensions (opts = null) { return ipc.gui.dimensions(this.id, opts) }
  minimize () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
    return ipc.gui.minimize(this.id)
  }

  maximize () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
    return ipc.gui.maximize(this.id)
  }

  fullscreen () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be fullscreened')
    return ipc.gui.fullscreen(this.id)
  }

  restore () { return ipc.gui.restore(this.id) }

  isVisible () { return ipc.gui.isVisible(this.id) }

  isMinimized () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
    return ipc.gui.isMinimized(this.id)
  }

  isMaximized () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
    return ipc.gui.isMaximized(this.id)
  }

  isFullscreen () {
    if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
    return ipc.gui.isFullscreen(this.id)
  }

  isClosed () { return ipc.gui.isClosed(this.id) }
}

class Window extends GuiCtrl {
  static [kGuiCtrl] = 'window'
}

class View extends GuiCtrl { static [kGuiCtrl] = 'view' }

const lightning = {
  info: () => {},
  configure: () => {},
  disconnect: () => {},
  balance: () => 0,
  pay: () => {},
  invoice: () => {},
  transactions: () => {}
}

const debug = {
  webrtc () { return ipc.gui.chrome('webrtc-internals') }
}

async function changelog (version) {
  return ipc.engine.changelog(version)
}

module.exports = {
  argv: isBare ? Bare.argv : process.argv,
  config,
  key,
  storage,
  message,
  messages,
  updates,
  checkpoint,
  teardown,
  hooks,
  preferences,
  media,
  restart,
  versions,
  View,
  Window,
  lightning,
  changelog,
  [Symbol.for('pear.ipc')]: ipc,
  [Symbol.for('pear.debug')]: debug
}

function createIpc (config) {
  const ipcRenderer = global[Symbol.for('pear.ipcRenderer')]
  if (!ipcRenderer) return null
  // need a lot more than 11 listeners but still want to detect out-of-control listener leaks:
  ipcRenderer.setMaxListeners(420)

  let id = global[Symbol.for('pear.id')]
  if (typeof id !== 'string') id = global[Symbol.for('pear.id')] = ipcRenderer.sendSync('id')

  class Domain {
    constructor (id, name, ...intras) {
      this.id = id
      this.name = name
      this.events = new EventMapper(id, name)
      this.intra = {
        events: new EventMapper(id, name, 'intra:'),
        ...(Object.fromEntries(intras.map((method) => [method, this.#between(method)])))
      }
    }

    channelize (method, prefix = '') {
      const { id, name } = this
      return `${prefix}${id}:${name}:${method}`
    }

    sync (method) {
      const channel = this.channelize(method)
      return (...args) => ipcRenderer?.sendSync(channel, ...this.#preprocess(args))
    }

    invoke (method) {
      const channel = this.channelize(method)
      return (...args) => ipcRenderer.invoke(channel, ...this.#preprocess(args))
    }

    iterable (method) {
      const channel = this.channelize(method)
      const bus = new Iambus()
      const listener = (e, payload, done = payload === null) => {
        if (done) ipcRenderer.removeListener(channel, listener)
        else bus.pub(payload.value)
      }
      ipcRenderer.on(channel, listener)
      let count = 0
      return (pattern, ...args) => {
        let signal = null
        if (pattern?.signal instanceof AbortSignal) {
          const { signal: sig, ...ptn } = pattern
          pattern = ptn
          signal = sig
        }

        const subscriber = bus.sub(pattern || {}, { signal })
        subscriber.once('close', () => { count-- })
        if (count === 0) {
          ipcRenderer.send(channel, ...this.#preprocess(pattern ? [{}, ...args] : args))
        }
        count++
        return subscriber
      }
    }

    #between (method) {
      const channel = this.channelize(method, 'intra:')
      return async (webContentsId, ...args) => {
        return ipcRenderer.sendTo(webContentsId, channel, ...this.#preprocess(args))
      }
    }

    #preprocess (args) {
      return args.map((arg) => arg instanceof Error ? { message: arg.message, code: arg.code } : arg)
    }
  }

  class EventMapper {
    constructor (id, domain, prefix = '') {
      this.id = id
      this.domain = domain
      this.prefix = prefix
      this.address = `${this.prefix}${this.id}:${this.domain}`
    }

    on (ns, ...args) {
      return ipcRenderer.on(`${this.address}:${ns}`, ...args)
    }

    once (ns, ...args) {
      return ipcRenderer.once(`${this.address}:${ns}`, ...args)
    }

    removeListener (ns, ...args) {
      return ipcRenderer.removeListener(`${this.address}:${ns}`, ...args)
    }

    removeAllListeners (ns, ...args) {
      return ipcRenderer.removeAllListeners(`${this.address}:${ns}`, ...args)
    }
  }

  const engine = new Domain(id, 'engine')
  const gui = new Domain(id, 'gui', 'send')
  const app = new Domain(id, 'app')
  const decal = new Domain(id, 'decal', 'bg', 'exit')

  return new class IPC {
    engine = {
      events: engine.events,
      intra: engine.intra,
      resolve: engine.sync('resolve'),
      platformResolve: engine.sync('platformResolve'),
      notifications: engine.iterable('notifications'),
      restart: engine.invoke('restart'),
      changelog: engine.invoke('changelog')
    }

    gui = {
      events: gui.events,
      intra: gui.intra,
      afterViewLoaded: gui.invoke('afterViewLoaded'),
      blur: gui.invoke('blur'),
      close: gui.invoke('close'),
      closing: gui.sync('closing'),
      completeUnload: gui.invoke('completeUnload'),
      ctrl: gui.sync('ctrl'),
      dimensions: gui.invoke('dimensions'),
      focus: gui.invoke('focus'),
      getMediaSourceId: gui.invoke('getMediaSourceId'),
      hide: gui.invoke('hide'),
      id: gui.sync('id'),
      isClosed: gui.invoke('isClosed'),
      isMinimized: gui.invoke('isMinimized'),
      isMaximized: gui.invoke('isMaximized'),
      isFullscreen: gui.invoke('isFullscreen'),
      isVisible: gui.invoke('isVisible'),
      minimize: gui.invoke('minimize'),
      maximize: gui.invoke('maximize'),
      fullscreen: gui.invoke('fullscreen'),
      open: gui.invoke('open'),
      parent: gui.invoke('parent'),
      parentId: gui.sync('parentId'),
      restore: gui.invoke('restore'),
      attachMainView: gui.invoke('attachMainView'),
      detachMainView: gui.invoke('detachMainView'),
      show: gui.invoke('show'),
      unloading: gui.invoke('unloading'),
      chrome: gui.invoke('chrome'),
      setWindowButtonPosition: gui.invoke('setWindowButtonPosition'),
      setWindowButtonVisibility: gui.invoke('setWindowButtonVisibility')
    }

    app = {
      events: app.events,
      intra: app.intra,
      config: app.invoke('config'),
      reconfig: app.iterable('reconfig'),
      iteratePreferences: app.iterable('iteratePreferences'),
      getPreference: app.invoke('getPreference'),
      messages: app.iterable('messages'),
      message: app.invoke('message'),
      options: app.invoke('options'),
      preferencesUpdates: app.iterable('preferencesUpdates'),
      setPreference: app.invoke('setPreference'),
      versions: app.invoke('versions'),
      askForMediaAccess: app.invoke('askForMediaAccess'),
      desktopSources: app.invoke('desktopSources'),
      getMediaAccessStatus: app.invoke('getMediaAccessStatus'),
      checkpoint: app.invoke('checkpoint'),
      createReport: app.invoke('createReport'),
      warming: app.iterable('warming'),
      warmup: app.invoke('warmup'),
      reports: app.iterable('reports'),
      restart: app.invoke('restart'),
      quit: app.sync('quit')
    }

    decal = {
      events: decal.events,
      intra: decal.intra
    }
  }()
}
