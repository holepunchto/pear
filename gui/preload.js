/* eslint-env browser */
'use strict'
const streamx = require('streamx')
const { EventEmitter } = require('events')
const Iambus = require('iambus')
const ReadyResource = require('ready-resource')
const electron = require('electron')
const Worker = require('../lib/worker')

module.exports = class PearGUI extends ReadyResource {
  constructor ({ API, ctx }) {
    super()
    const id = this.id = electron.ipcRenderer.sendSync('id')
    this.ipc = new IPC()
    electron.ipcRenderer.on('ipc', (e, data) => {
      this.ipc.stream.push(Buffer.from(data))
    })

    const onteardown = async (fn) => {
      if (ctx.isDecal) return
      await this.ready()
      const action = await this.ipc.unloading({ id }) // only resolves when unloading occurs
      await fn()
      await this.ipc.completeUnload({ id, action })
      if (action.type === 'reload') location.reload()
      else if (action.type === 'nav') location.href = action.url
    }
    API = class extends API {
      constructor (ipc, ctx, onteardown) {
        super(ipc, ctx, onteardown)
        this[Symbol.for('pear.ipc')] = ipc
        this.worker = new Worker({ ipc })
        this.media = {
          status: {
            microphone: () => ipc.getMediaAccessStatus({ id, media: 'microphone' }),
            camera: () => ipc.getMediaAccessStatus({ id, media: 'camera' }),
            screen: () => ipc.getMediaAccessStatus({ id, media: 'screen' })
          },
          access: {
            microphone: () => ipc.askForMediaAccess({ id, media: 'microphone' }),
            camera: () => ipc.askForMediaAccess({ id, media: 'camera' }),
            screen: () => ipc.askForMediaAccess({ id, media: 'screen' })
          },
          desktopSources: (options = {}) => ipc.desktopSources(options)
        }

        const kGuiCtrl = Symbol('gui:ctrl')

        class Parent extends EventEmitter {
          #id
          constructor (id) {
            super()
            this.#id = id
            electron.ipcRenderer.on('send', (e, ...args) => {
              this.emit('message', ...args)
            })
          }

          send (...args) { return electron.ipcRenderer.sendTo(this.#id, ...args) }
          focus (options = null) { return ipc.parent({ act: 'focus', id: this.#id, options }) }
          blur () { return ipc.parent({ act: 'blur', id: this.#id }) }
          show () { return ipc.parent({ act: 'show', id: this.#id }) }
          hide () { return ipc.parent({ act: 'hide', id: this.#id }) }
          minimize () { return ipc.parent({ act: 'minimize', id: this.#id }) }
          maximize () { return ipc.parent({ act: 'maximize', id: this.#id }) }
          fullscreen () { return ipc.parent({ act: 'fullscreen', id: this.#id }) }
          restore () { return ipc.parent({ act: 'restore', id: this.#id }) }
          dimensions (options = null) { return ipc.parent({ act: 'dimensions', id: this.#id, options }) }
          getMediaSourceId () { return ipc.parent({ act: 'getMediaSourceId', id: this.#id }) }
          isVisible () { return ipc.parent({ act: 'isVisible', id: this.#id }) }
          isMinimized () { return ipc.parent({ act: 'isMinimized', id: this.#id }) }
          isMaximized () { return ipc.parent({ act: 'isMaximized', id: this.#id }) }
          isFullscreen () { return ipc.parent({ act: 'isFullscreen', id: this.#id }) }
          isClosed () { return ipc.parent({ act: 'isClosed', id: this.#id }) }
        }

        class Self {
          constructor (id) { this.id = id }
          focus (options = null) { return ipc.focus({ id: this.id, options }) }
          blur () { return ipc.blur({ id: this.id }) }
          show () { return ipc.show({ id: this.id }) }
          hide () { return ipc.hide({ id: this.id }) }
          minimize () { return ipc.minimize({ id: this.id }) }
          maximize () { return ipc.maximize({ id: this.id }) }
          fullscreen () { return ipc.fullscreen({ id: this.id }) }
          restore () { return ipc.restore({ id: this.id }) }
          close () { return ipc.close({ id: this.id }) }
          getMediaSourceId () { return ipc.getMediaSourceId({ id: this.id }) }
          dimensions (options = null) { return ipc.dimensions({ id: this.id, options }) }
          isVisible () { return ipc.isVisible({ id: this.id }) }
          isMinimized () { return ipc.isMinimized({ id: this.id }) }
          isMaximized () { return ipc.isMaximized({ id: this.id }) }
          isFullscreen () { return ipc.isFullscreen({ id: this.id }) }
        }

        class GuiCtrl extends EventEmitter {
          #listener = null

          static get parent () {
            Object.defineProperty(this, 'parent', {
              value: new Parent(electron.ipcRenderer.sendSync('parentId'))
            })
            return this.parent
          }

          static get self () {
            Object.defineProperty(this, 'self', {
              value: new Self(electron.ipcRenderer.sendSync('id'))
            })
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
            electron.ipcRenderer.on('send', this.#listener)
          }

          #unrxtx () {
            if (this.#listener === null) return
            electron.ipcRenderer.removeListener('send', this.#listener)
            this.#listener = null
          }

          async open (opts) {
            if (this.id === null) {
              await new Promise(setImmediate) // needed for windows/views opening on app load
              this.#rxtx()
              this.id = await ipc.ctrl({
                parentId: this.self.id,
                type: this.constructor[kGuiCtrl],
                entry: this.entry,
                options: this.options,
                ctx: this.ctx,
                openOptions: opts
              })
              return true
            }
            return await ipc.open({ id: this.id })
          }

          async close () {
            const result = await ipc.close({ id: this.id })
            this.#unrxtx()
            this.id = null
            return result
          }

          show () { return ipc.show({ id: this.id }) }
          hide () { return ipc.hide({ id: this.id }) }
          focus (options = null) { return ipc.focus({ id: this.id, options }) }
          blur () { return ipc.blur({ id: this.id }) }

          getMediaSourceId () { return ipc.getMediaSourceId({ id: this.id }) }
          dimensions (options = null) { return ipc.dimensions({ id: this.id, options }) }
          minimize () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
            return ipc.minimize({ id: this.id })
          }

          maximize () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return ipc.maximize({ id: this.id })
          }

          fullscreen () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be fullscreened')
            return ipc.fullscreen({ id: this.id })
          }

          restore () { return ipc.restore({ id: this.id }) }

          isVisible () { return ipc.isVisible({ id: this.id }) }

          isMinimized () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
            return ipc.isMinimized({ id: this.id })
          }

          isMaximized () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return ipc.isMaximized({ id: this.id })
          }

          isFullscreen () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return ipc.isFullscreen({ id: this.id })
          }

          isClosed () { return ipc.isClosed({ id: this.id }) }

          send (...args) { return electron.ipcRenderer.sendTo(this.id, ...args) }
        }

        class Window extends GuiCtrl {
          static [kGuiCtrl] = 'window'
        }

        class View extends GuiCtrl { static [kGuiCtrl] = 'view' }

        this.Window = Window
        this.View = View
      }

      exit (code) {
        process.exitCode = code
        electron.app.quit()
      }
    }
    this.api = new API(this.ipc, ctx, onteardown)
  }
}

class IPC {
  getMediaAccessStatus (...args) { return electron.ipcRenderer.invoke('getMediaAccessStatus', ...args) }
  askForMediaAccess (...args) { return electron.ipcRenderer.invoke('askForMediaAccess', ...args) }
  desktopSources (...args) { return electron.ipcRenderer.invoke('desktopSources', ...args) }
  chrome (...args) { return electron.ipcRenderer.invoke('chrome', ...args) }
  ctrl (...args) { return electron.ipcRenderer.invoke('ctrl', ...args) }
  parent (...args) { return electron.ipcRenderer.invoke('parent', ...args) }
  open (...args) { return electron.ipcRenderer.invoke('open', ...args) }
  close (...args) { return electron.ipcRenderer.invoke('close', ...args) }
  show (...args) { return electron.ipcRenderer.invoke('show', ...args) }
  hide (...args) { return electron.ipcRenderer.invoke('hide', ...args) }
  minimize (...args) { return electron.ipcRenderer.invoke('minimize', ...args) }
  maximize (...args) { return electron.ipcRenderer.invoke('maximize', ...args) }
  fullscreen (...args) { return electron.ipcRenderer.invoke('fullscreen', ...args) }
  restore (...args) { return electron.ipcRenderer.invoke('restore', ...args) }
  focus (...args) { return electron.ipcRenderer.invoke('focus', ...args) }
  blur (...args) { return electron.ipcRenderer.invoke('blur', ...args) }
  getMediaSourceId (...args) { return electron.ipcRenderer.invoke('getMediaSourceId', ...args) }
  dimensions (...args) { return electron.ipcRenderer.invoke('dimensions', ...args) }
  isVisible (...args) { return electron.ipcRenderer.invoke('isVisible', ...args) }
  isClosed (...args) { return electron.ipcRenderer.invoke('isClosed', ...args) }
  isMinimized (...args) { return electron.ipcRenderer.invoke('isMinimized', ...args) }
  isMaximized (...args) { return electron.ipcRenderer.invoke('isMaximized', ...args) }
  isFullscreen (...args) { return electron.ipcRenderer.invoke('isFullscreen', ...args) }
  setSize (...args) { return electron.ipcRenderer.invoke('setSize', ...args) }
  trust (...args) { return electron.ipcRenderer.invoke('trust', ...args) }
  unloading (...args) { return electron.ipcRenderer.invoke('unloading', ...args) }
  completeUnload (...args) { return electron.ipcRenderer.invoke('completeUnload', ...args) }
  attachMainView (...args) { return electron.ipcRenderer.invoke('attachMainView', ...args) }
  detachMainView (...args) { return electron.ipcRenderer.invoke('detachMainView', ...args) }
  afterViewLoaded (...args) { return electron.ipcRenderer.invoke('afterViewLoaded', ...args) }
  setWindowButtonPosition (...args) { return electron.ipcRenderer.invoke('setWindowButtonPosition', ...args) }
  setWindowButtonVisibility (...args) { return electron.ipcRenderer.invoke('setWindowButtonVisibility', ...args) }
  message (...args) { return electron.ipcRenderer.invoke('message', ...args) }
  checkpoint (...args) { return electron.ipcRenderer.invoke('checkpoint', ...args) }
  versions (...args) { return electron.ipcRenderer.invoke('versions', ...args) }
  restart (...args) { return electron.ipcRenderer.invoke('restart', ...args) }

  messages (pattern) {
    electron.ipcRenderer.send('messages', pattern)
    const bus = new Iambus()
    electron.ipcRenderer.on('messages', (e, msg) => {
      if (msg === null) bus.end()
      else bus.pub(msg)
    })
    const stream = bus.sub(pattern)
    return stream
  }

  warming () {
    electron.ipcRenderer.send('warming')
    const stream = new streamx.Readable()
    electron.ipcRenderer.on('warming', (e, data) => { stream.push(data) })
    return stream
  }

  reports () {
    electron.ipcRenderer.send('reports')
    const stream = new streamx.Readable()
    electron.ipcRenderer.on('reports', (e, data) => { stream.push(data) })
    return stream
  }

  workerRun (link) {
    const id = electron.ipcRenderer.sendSync('workerPipeId')
    electron.ipcRenderer.send('workerRun', link)
    const stream = new streamx.Duplex({
      write (data, cb) {
        electron.ipcRenderer.send('workerPipeWrite', id, data)
        cb()
      }
    })
    electron.ipcRenderer.on('workerPipeError', (e, stack) => {
      stream.emit('error', new Error('Worker PipeError (from electron-main): ' + stack))
    })
    electron.ipcRenderer.on('workerClose', () => { stream.destroy() })
    stream.once('close', () => {
      electron.ipcRenderer.send('workerPipeClose', id)
    })

    electron.ipcRenderer.on('workerPipeData', (e, data) => { stream.push(data) })
    return stream
  }

  ref () {}
  unref () {}

  // DEPRECATED - assess to remove from Sep 2024
  preferences () {
    electron.ipcRenderer.send('preferences')
    const stream = new streamx.Readable()
    electron.ipcRenderer.on('preferences', (e, data) => { stream.push(data) })
    return stream
  }

  setPreference (key, value) {
    return electron.ipcRenderer.invoke('setPreference', key, value)
  }

  getPreference (key) {
    return electron.ipcRenderer.invoke('getPreference', key)
  }

  list () {
    electron.ipcRenderer.send('iteratePreferences')
    const stream = new streamx.Readable()
    electron.ipcRenderer.on('iteratePreferences', (e, data) => { stream.push(data) })
    return stream
  }
}
