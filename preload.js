'use strict'
/* eslint-env node, browser */
if (process.isMainFrame) {
  const timers = require('timers')
  const runtime = require('script-linker/runtime')
  const { builtins, platform, app } = require('./lib/gunk')
  const electron = require('electron')
  window[Symbol.for('pear.ipcRenderer')] = electron.ipcRenderer

  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  const { parentWcId, env, cwd, id, decalled = false, isDecal = false, ...config } = JSON.parse(process.argv.slice(isWin ? -2 : -1)[0])

  window[Symbol.for('pear.config')] = config
  window[Symbol.for('pear.id')] = id
  const pear = require('./lib/pear')
  window.Pear = pear
  const { ipc } = pear

  if (isDecal === false) {
    window[Symbol.for('pear.config')] = config
    window[Symbol.for('pear.id')] = id

    Object.assign(process.env, env)
    process.chdir(cwd)

    let unloading = null
    window[Symbol.for('pear.unloading')] = new Promise((resolve) => { unloading = resolve })
    const unload = async () => {
      const id = ipc.gui.id()
      const action = await ipc.gui.unloading(id) // only resolves when unloading occurs
      unloading(action) // resolve global promise and trigger user suspend functions
      const MAX_TEARDOWN_WAIT = 5000
      const timeout = new Promise((resolve) => setTimeout(resolve, MAX_TEARDOWN_WAIT))
      await Promise.race([window[Symbol.for('pear.unloading')], timeout])
      if (action.type === 'reload') location.reload()
      else if (action.type === 'nav') location.href = action.url
      await ipc.gui.completeUnload(id, action)
    }

    const syncConfig = async () => {
      for await (const config of ipc.app.reconfig()) {
        Object.assign(window[Symbol.for('pear.config')], config)
      }
    }

    syncConfig().catch(console.error)
    unload().catch(console.error)
  }

  {
    const { setTimeout, clearTimeout, setImmediate, clearImmediate, setInterval, clearInterval } = timers
    global.setTimeout = setTimeout
    global.clearTimeout = clearTimeout
    global.setImmediate = setImmediate
    global.clearImmediate = clearImmediate
    global.setInterval = setInterval
    global.clearInterval = clearInterval
  }

  if (decalled) {
    process.once('exit', (code) => {
      const actuallyARefresh = code === undefined
      if (actuallyARefresh) return
      ipc.decal.intra.exit(parentWcId, code)
    })
  }

  // we do proper wrapping for cjs scopes and these should not be in esm scopes
  delete global.require
  delete global.module
  delete global.__dirname
  delete global.__filename

  const { warn } = console
  console.warn = (msg, ...args) => {
    if (/Insecure Content-Security-Policy/.test(msg)) return
    warn.call(console, msg, ...args)
  }

  // platform runtime:
  const pltsl = runtime({
    builtins,
    map: platform.map,
    mapImport: platform.mapImport,
    symbol: platform.symbol,
    protocol: platform.protocol,
    getSync (url) {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, false)
      xhr.send(null)
      return xhr.responseText
    },
    resolveSync (req, dirname, { isImport }) {
      const xhr = new XMLHttpRequest()
      const type = isImport ? 'esm' : 'cjs'
      const url = `${dirname}/~${req}+platform-resolve+${type}`
      xhr.open('GET', url, false)
      xhr.send(null)
      return xhr.responseText
    }
  })

  // app runtime:
  const appsl = runtime({
    builtins,
    map: app.map,
    mapImport: app.mapImport,
    symbol: app.symbol,
    protocol: app.protocol,
    getSync (url) {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, false)
      xhr.send(null)
      return xhr.responseText
    },
    resolveSync (req, dirname, { isImport }) {
      const xhr = new XMLHttpRequest()
      const type = isImport ? 'esm' : 'cjs'
      const url = `${dirname}/~${req}+resolve+${type}`
      xhr.open('GET', url, false)
      xhr.send(null)
      if (xhr.status !== 200) throw new Error(`${xhr.status} ${xhr.responseText}`)
      return xhr.responseText
    }
  })

  async function warm () {
    for await (const { batch, protocol } of ipc.app.warming()) {
      let sl = null
      if (protocol === 'pear' || protocol === 'holepunch') sl = pltsl
      if (protocol === 'app') sl = appsl
      if (sl === null) continue
      for (const { filename, source } of batch) sl.sources.set(filename, source)
    }
  }

  if (isDecal === false) warm().catch(console.error)

  customElements.define('pear-ctrl', class extends HTMLElement {
    #onfocus = null
    #onblur = null
    #demax = null
    connectedCallback () {
      this.dataset.platform = process.platform
      const min = this.root.querySelector('#min')
      const max = this.root.querySelector('#max')
      const restore = this.root.querySelector('#restore')
      const close = this.root.querySelector('#close')
      min.addEventListener('click', this.#min)
      max.addEventListener('click', this.#max)
      if (restore) restore.addEventListener('click', this.#restore)
      close.addEventListener('click', this.#close)
      window.addEventListener('focus', this.#onfocus)
      window.addEventListener('blur', this.#onblur)
      window.addEventListener('__macos-exit-fullscreen', this.#demax)
      window.addEventListener('mouseover', (e) => {
        const x = e.clientX
        const y = e.clientY
        if (document.elementFromPoint(x, y) === this) this.#onfocus()
      })
    }

    disconnectedCallback () {
      const min = this.root.querySelector('#min')
      const max = this.root.querySelector('#max')
      const restore = this.root.querySelector('#restore')
      const close = this.root.querySelector('#close')
      min.removeEventListener('click', this.#min)
      max.removeEventListener('click', this.#max)
      if (restore) restore.removeEventListener('click', this.#restore)
      close.removeEventListener('click', this.#close)
      window.removeEventListener('focus', this.#onfocus)
      window.removeEventListener('blur', this.#onblur)
      window.removeEventListener('__macos-exit-fullscreen', this.#demax)
    }

    constructor () {
      super()
      this.template = document.createElement('template')
      this.template.innerHTML = isWin ? this.#win() : (isMac ? this.#mac() : this.#gen())
      this.root = this.attachShadow({ mode: 'open' })
      this.root.appendChild(this.template.content.cloneNode(true))
      this.#onfocus = () => this.root.querySelector('#ctrl').classList.add('focused')
      this.#onblur = () => this.root.querySelector('#ctrl').classList.remove('focused')
      this.#demax = () => this.root.querySelector('#ctrl').classList.remove('max')
    }

    async #min () { await pear.Window.self.minimize() }
    async #max (e) {
      if (isMac) await pear.Window.self.fullscreen()
      else await pear.Window.self.maximize()
      e.target.root.querySelector('#ctrl').classList.add('max')
    }

    async #restore (e) {
      await pear.Window.self.restore()
      e.target.root.querySelector('#ctrl').classList.remove('max')
    }

    async #close () { await pear.Window.self.close() }
    #win () {
      return `
    <style>
      #ctrl {
        user-select: none;
        -webkit-app-region: no-drag;
        display: table-row;
        float: right;
        margin-left: .6em;
        margin-top: 0.22em;
        border-spacing: 0.3em 0;
      }
      #ctrl > .ctrl {
        opacity: 0.8;
        height: 24px;
        width: 24px;
        display: table-cell;
        vertical-align: middle;
        text-align: center;
      }
      #ctrl > .ctrl:hover {
        opacity: 1;
      }
      .max #max  {
        display: none;
      }
      #restore.ctrl  {
        display: none;
      }
      .max #restore.ctrl  {
        display: table-cell;
      }

    </style>
    <div id="ctrl">
      <div id="min" class="ctrl">
        <svg width="18" height="2" viewBox="0 0 18 2" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0.5625C0 0.28125 0.246094 0 0.5625 0H17.4375C17.7188 0 18 0.28125 18 0.5625C18 0.878906 17.7188 1.125 17.4375 1.125H0.5625C0.246094 1.125 0 0.878906 0 0.5625Z" fill="white"/>
        </svg>
      </div>
      <div id="max" class="ctrl">
        <svg width="18" height="17" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 2.625C0 1.39453 0.984375 0.375 2.25 0.375H15.75C16.9805 0.375 18 1.39453 18 2.625V13.875C18 15.1406 16.9805 16.125 15.75 16.125H2.25C0.984375 16.125 0 15.1406 0 13.875V2.625ZM1.125 2.625V6H16.875V2.625C16.875 2.02734 16.3477 1.5 15.75 1.5H2.25C1.61719 1.5 1.125 2.02734 1.125 2.625ZM1.125 7.125V13.875C1.125 14.5078 1.61719 15 2.25 15H15.75C16.3477 15 16.875 14.5078 16.875 13.875V7.125H1.125Z" fill="white"/>
        </svg>
      </div>
      <div id="restore" class="ctrl">
        <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.1875 1.375H7.3125C6.36328 1.375 5.625 2.14844 5.625 3.0625V3.625H4.5V3.0625C4.5 1.51562 5.73047 0.25 7.3125 0.25H15.1875C16.7344 0.25 18 1.51562 18 3.0625V10.9375C18 12.5195 16.7344 13.75 15.1875 13.75H14.625V12.625H15.1875C16.1016 12.625 16.875 11.8867 16.875 10.9375V3.0625C16.875 2.14844 16.1016 1.375 15.1875 1.375ZM11.25 4.75C12.4805 4.75 13.5 5.76953 13.5 7V16C13.5 17.2656 12.4805 18.25 11.25 18.25H2.25C0.984375 18.25 0 17.2656 0 16V7C0 5.76953 0.984375 4.75 2.25 4.75H11.25ZM11.25 5.875H2.25C1.61719 5.875 1.125 6.40234 1.125 7V9.25H12.375V7C12.375 6.40234 11.8477 5.875 11.25 5.875ZM2.25 17.125H11.25C11.8477 17.125 12.375 16.6328 12.375 16V10.375H1.125V16C1.125 16.6328 1.61719 17.125 2.25 17.125Z" fill="white"/>
        </svg>
      </div>
      <div id="close" class="ctrl">
        <svg id="close" width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.8906 0.550781C15.1016 0.339844 15.4883 0.339844 15.6992 0.550781C15.9102 0.761719 15.9102 1.14844 15.6992 1.35938L8.77344 8.25L15.6992 15.1758C15.9102 15.3867 15.9102 15.7734 15.6992 15.9844C15.4883 16.1953 15.1016 16.1953 14.8906 15.9844L8 9.05859L1.07422 15.9844C0.863281 16.1953 0.476562 16.1953 0.265625 15.9844C0.0546875 15.7734 0.0546875 15.3867 0.265625 15.1758L7.19141 8.25L0.265625 1.35938C0.0546875 1.14844 0.0546875 0.761719 0.265625 0.550781C0.476562 0.339844 0.863281 0.339844 1.07422 0.550781L8 7.47656L14.8906 0.550781Z" fill="white"/>
        </svg>
      </div>
    </div>
    `
    }

    #mac () {
      return `
      <style>
        :host {
          display: table;
          font-family: none;
        }
        #ctrl {
          -webkit-app-region: no-drag;
          user-select: none;
          display: table-row;
          float: right;
        }

        #ctrl > .ctrl {
          border-radius: 100%;
          padding: 0;
          height: 12px;
          width: 12px;
          outline: 1px solid rgba(0, 0, 0, 0.06);
          margin-right: 2px;
          margin-left: 1px;
          position: relative;
          display: table-cell;
          vertical-align: middle;
        }
        #ctrl.max {
          display: none;
        }
        #ctrl > .ctrl:before, #ctrl > .ctrl:after {
          content: "";
          position: absolute;
          border-radius: 1px;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          margin: auto;
          visibility: hidden;
        }

        #ctrl:hover > .ctrl:before, #ctrl:hover > .ctrl:after {
          visibility: visible;
        }

        .ctrl {
          background-color: rgb(73, 76, 76);
          border: 1px solid rgb(73, 76, 76);
        }

        #ctrl:hover > #close, #ctrl.focused > #close {
          background-color: rgb(253, 119, 114);
          border: 1px solid rgb(253, 119, 114);
        }

        #close:active {
          background-color: rgb(253, 70, 70)
        }

        #close:after, #close:before {
          background-color: rgba(77, 0, 0, 75%);
          width: 8px;
          height: 1px;
          transform: rotate(45deg);
        }

        #close:before {
          transform: rotate(-45deg);
        }

        #ctrl:hover > #min, #ctrl.focused > #min  {
          background-color: rgb(254, 176, 36);
          border: 1px solid  rgb(254, 176, 36);
        }
        #min:active {
          background-color: rgb(254, 252, 75)!important;
        }

        #ctrl:hover > #max, #ctrl.focused > #max  {
          background-color: rgb(42, 193, 49, .9);
          border: 1px solid  rgb(42, 193, 49, .9);
        }

        #max:before {
          background-color: #006500;
          width: 6px;
          height: 6px;
        }
        #max:after {
          background-color: rgb(42, 193, 49, .9);
          width: 10px;
          height: 2px;
          transform: rotate(-45deg);
        }
        #max:active, #max:active:after {
          background-color: rgb(78, 250, 92)!important;
        }

        #min:before {
          background-color: rgb(160, 93, 12);
          width: 8px;
          height: 1px;
        }

        #min:after {
          background-color: rgb(179, 108, 17, .9);
          width: 8px;
          height: 2px;
        }
      </style>
      <div id="ctrl">
        <button id="close" class="ctrl"></button>
        <button id="min" class="ctrl"></button>
        <button id="max" class="ctrl"></button>
      </div>
      `
    }

    #gen () {
      return '<span></span>' // linux uses frame
    }
  })
}

// support for native addons triggering uncaughtExceptions
process.on('uncaughtException', (err) => { console.error('Uncaught exception detected', err) })
