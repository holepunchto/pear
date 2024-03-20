/* eslint-env browser */
'use strict'
const { EventEmitter } = require('events')
const ReadyResource = require('ready-resource')
const electron = require('electron')
const streamx = require('streamx')
const RPC = require('pear-rpc')
const methods = require('./methods')

module.exports = class PearGUI extends ReadyResource {
  async _open () {
    await this.scipc.ready()
    await this.emipc.ready()
  }

  async _close () {
    await this.emipc.close()
    await this.scipc.close()
  }

  constructor ({ socketPath, connectTimeout, API, ctx }) {
    super()
    const id = this.id = electron.ipcRenderer.sendSync('id')
    this.scipc = new RPC({ connect: true, socketPath, connectTimeout, methods })
    this.emipc = new RPC({
      methods,
      stream: new streamx.Duplex({
        write (data, cb) {
          electron.ipcRenderer.send('ipc', data)
          cb()
        }
      })
    })
    electron.ipcRenderer.on('ipc', (e, data) => {
      this.emipc.stream.push(Buffer.from(data))
    })

    const onteardown = async (fn) => {
      if (!ctx.isDecal) return
      await this.ready()
      const action = await this.emipc.unloading({ id }) // only resolves when unloading occurs
      fn(action) // resolve global promise and trigger user suspend functions
      const MAX_TEARDOWN_WAIT = 5000
      const timeout = new Promise((resolve) => setTimeout(resolve, MAX_TEARDOWN_WAIT))
      await Promise.race([window[Symbol.for('pear.unloading')], timeout])
      if (action.type === 'reload') location.reload()
      else if (action.type === 'nav') location.href = action.url
      await this.emipc.completeUnload({ id, action })
    }
    API = class extends API {
      constructor (ipc, ctx, onteardown) {
        super(ipc, ctx, onteardown)
        this[Symbol.for('pear.rpc')] = ipc
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
          desktopSources: (options = null) => ipc.desktopSources(options = null)
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
    this.api = new API(this.emipc, ctx, onteardown)
  }
}
