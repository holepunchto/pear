'use strict'
const { EventEmitter } = require('events')
const electron = require('electron')
const streamx = require('streamx')
const RPC = require('pear-rpc')
const methods = require('./methods')

module.exports = class PearGUI {
  constructor ({ API, ctx }) {
    this.rpc = new RPC({
      methods: methods,
      stream: new streamx.Duplex({
        write (data, cb) {
          electron.ipcRenderer.send('rpc', data)
          cb()
        }
      })
    })
    const onteardown = async (fn) => {
      if (!ctx.isDecal) return
      const action = await this.rpc.unloading() // only resolves when unloading occurs
      fn(action) // resolve global promise and trigger user suspend functions
      const MAX_TEARDOWN_WAIT = 5000
      const timeout = new Promise((resolve) => setTimeout(resolve, MAX_TEARDOWN_WAIT))
      await Promise.race([window[Symbol.for('pear.unloading')], timeout])
      if (action.type === 'reload') location.reload()
      else if (action.type === 'nav') location.href = action.url
      await this.rpc.completeUnload(action)
    }
    API = class extends API {
      constructor (rpc, ctx, onteardown) {
        super(rpc, ctx, onteardown)
        this[Symbol.for('pear.rpc')] = rpc
        this.media = {
          status: {
            microphone: () => rpc.getMediaAccessStatus({ media: 'microphone' }),
            camera: () => rpc.getMediaAccessStatus({ media: 'camera' }),
            screen: () => rpc.getMediaAccessStatus({ media: 'screen' })
          },
          access: {
            microphone: () => rpc.askForMediaAccess({ media: 'microphone' }),
            camera: () => rpc.askForMediaAccess({ media: 'camera' }),
            screen: () => rpc.askForMediaAccess({ media: 'screen' })
          },
          desktopSources: (options = null) => rpc.desktopSources(options = null)
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
          focus (options = null) { return rpc.parent({ act: 'focus', id: this.#id, options }) }
          blur () { return rpc.parent({ act: 'blur', id: this.#id }) }
          show () { return rpc.parent({ act: 'show', id: this.#id }) }
          hide () { return rpc.parent({ act: 'hide', id: this.#id }) }
          minimize () { return rpc.parent({ act: 'minimize', id: this.#id }) }
          maximize () { return rpc.parent({ act: 'maximize', id: this.#id }) }
          fullscreen () { return rpc.parent({ act: 'fullscreen', id: this.#id }) }
          restore () { return rpc.parent({ act: 'restore', id: this.#id }) }
          dimensions (options = null) { return rpc.parent({ act: 'dimensions', id: this.#id, options }) }
          getMediaSourceId () { return rpc.parent({ act: 'getMediaSourceId', id: this.#id }) }
          isVisible () { return rpc.parent({ act: 'isVisible', id: this.#id }) }
          isMinimized () { return rpc.parent({ act: 'isMinimized', id: this.#id }) }
          isMaximized () { return rpc.parent({ act: 'isMaximized', id: this.#id }) }
          isFullscreen () { return rpc.parent({ act: 'isFullscreen', id: this.#id }) }
          isClosed () { return rpc.parent({ act: 'isClosed', id: this.#id }) }
        }
  
        class Self {
          constructor (id) { this.id = id }
          focus (options = null) { return rpc.focus({ id: this.id, options }) }
          blur () { return rpc.blur({ id: this.id }) }
          show () { return rpc.show({ id: this.id }) }
          hide () { return rpc.hide({ id: this.id }) }
          minimize () { return rpc.minimize({ id: this.id }) }
          maximize () { return rpc.maximize({ id: this.id }) }
          fullscreen () { return rpc.fullscreen({ id: this.id }) }
          restore () { return rpc.restore({ id: this.id }) }
          close () { return rpc.close({ id: this.id }) }
          getMediaSourceId () { return rpc.getMediaSourceId({ id: this.id }) }
          dimensions (options = null) { return rpc.dimensions({ id: this.id, options }) }
          isVisible () { return rpc.isVisible({ id: this.id }) }
          isMinimized () { return rpc.isMinimized({ id: this.id }) }
          isMaximized () { return rpc.isMaximized({ id: this.id }) }
          isFullscreen () { return rpc.isFullscreen({ id: this.id }) }
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
              this.id = await rpc.ctrl({
                parentId: this.self.id,
                type: this.constructor[kGuiCtrl],
                entry: this.entry,
                options: this.options,
                ctx: this.ctx,
                openOptions: opts
              })
              return true
            }
            return await rpc.open({ id: this.id })
          }
  
          async close () {
            const result = await rpc.close({ id: this.id })
            this.#unrxtx()
            this.id = null
            return result
          }
  
          show () { return rpc.show({ id: this.id }) }
          hide () { return rpc.hide({ id: this.id }) }
          focus (options = null) { return rpc.focus({ id: this.id, options }) }
          blur () { return rpc.blur({ id: this.id }) }
  
          getMediaSourceId () { return rpc.getMediaSourceId({ id: this.id }) }
          dimensions (options = null) { return rpc.dimensions({ id: this.id, options }) }
          minimize () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
            return rpc.minimize({ id: this.id })
          }
  
          maximize () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return rpc.maximize({ id: this.id })
          }
  
          fullscreen () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be fullscreened')
            return rpc.fullscreen({ id: this.id })
          }
  
          restore () { return rpc.restore({ id: this.id }) }
  
          isVisible () { return rpc.isVisible({ id: this.id }) }
  
          isMinimized () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be minimized')
            return rpc.isMinimized({ id: this.id })
          }
  
          isMaximized () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return rpc.isMaximized({ id: this.id })
          }
  
          isFullscreen () {
            if (this.constructor[kGuiCtrl] === 'view') throw new Error('A View cannot be maximized')
            return rpc.isFullscreen({ id: this.id })
          }
  
          isClosed () { return rpc.isClosed({ id: this.id }) }
  
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
    this.api = new API(this.rpc, ctx, onteardown) 
    electron.ipcRenderer.on('rpc', (e, data) => this.rpc.stream.push(Buffer.from(data)))
  }

}