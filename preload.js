'use strict'
/* global Pear */
/* eslint-env node, browser */
if (process.isMainFrame) {
  const timers = require('timers')
  const runtime = require('script-linker/runtime')
  const gunk = require('./lib/gunk')
  const electron = require('electron')
  const { isMac, isWindows, platform } = require('which-runtime')
  window[Symbol.for('pear.ipcRenderer')] = electron.ipcRenderer

  const { parentWcId, env, cwd, id, decalled = false, isDecal = false, ...config } = JSON.parse(process.argv.slice(isWindows ? -2 : -1)[0])

  window[Symbol.for('pear.config')] = config
  window[Symbol.for('pear.id')] = id
  window.Pear = require('./lib/pear')
  const ipc = Pear[Symbol.for('pear.ipc')]
  const guiid = ipc.gui.id()
  if (isDecal === false) {
    window[Symbol.for('pear.config')] = config
    window[Symbol.for('pear.id')] = id

    Object.assign(process.env, env)
    process.chdir(cwd)

    let unloading = null
    window[Symbol.for('pear.unloading')] = new Promise((resolve) => { unloading = resolve })
    const unload = async () => {
      const action = await ipc.gui.unloading(guiid) // only resolves when unloading occurs
      unloading(action) // resolve global promise and trigger user suspend functions
      const MAX_TEARDOWN_WAIT = 5000
      const timeout = new Promise((resolve) => setTimeout(resolve, MAX_TEARDOWN_WAIT))
      await Promise.race([window[Symbol.for('pear.unloading')], timeout])
      if (action.type === 'reload') location.reload()
      else if (action.type === 'nav') location.href = action.url
      await ipc.gui.completeUnload(guiid, action)
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
    builtins: gunk.builtins,
    map: gunk.platform.map,
    mapImport: gunk.platform.mapImport,
    symbol: gunk.platform.symbol,
    protocol: gunk.platform.protocol,
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
    builtins: gunk.builtins,
    map: gunk.app.map,
    mapImport: gunk.app.mapImport,
    symbol: gunk.app.symbol,
    protocol: gunk.app.protocol,
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
      this.dataset.platform = platform
      if (isMac) {
        const ctrl = this.root.querySelector('#ctrl')
        this.mutations = new MutationObserver(async (m) => {
          const { x, y } = ctrl.getBoundingClientRect()
          await ipc.gui.setWindowButtonPosition(guiid, { x, y: y - 6 })
        })
        this.mutations.observe(this, { attributes: true })

        this.intesections = new IntersectionObserver(async ([element]) => {
          await ipc.gui.setWindowButtonVisibility(guiid, element.isIntersecting)
          const { x, y } = ctrl.getBoundingClientRect()
          await ipc.gui.setWindowButtonPosition(guiid, { x, y: y - 6 })
        }, { threshold: 0 })

        this.intesections.observe(this)
        return
      }
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
      window.addEventListener('mouseover', (e) => {
        const x = e.clientX
        const y = e.clientY
        if (document.elementFromPoint(x, y) === this) this.#onfocus()
      })
    }

    disconnectedCallback () {
      if (isMac) {
        this.mutations.disconnect()
        this.intesections.disconnect()
        return
      }

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
    }

    constructor () {
      super()
      this.template = document.createElement('template')
      this.template.innerHTML = isWindows ? this.#win() : (isMac ? this.#mac() : this.#gen())
      this.root = this.attachShadow({ mode: 'open' })
      this.root.appendChild(this.template.content.cloneNode(true))
      this.#onfocus = () => this.root.querySelector('#ctrl').classList.add('focused')
      this.#onblur = () => this.root.querySelector('#ctrl').classList.remove('focused')
      this.#demax = () => this.root.querySelector('#ctrl').classList.remove('max')
    }

    async #min () { await Pear.Window.self.minimize() }
    async #max (e) {
      if (isMac) await Pear.Window.self.fullscreen()
      else await Pear.Window.self.maximize()
      e.target.root.querySelector('#ctrl').classList.add('max')
    }

    async #restore (e) {
      await Pear.Window.self.restore()
      e.target.root.querySelector('#ctrl').classList.remove('max')
    }

    async #close () { await Pear.Window.self.close() }
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12.998H5V10.998H19V12.998Z" fill="white"/>
        </svg>
      </div>
      <div id="max" class="ctrl">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="12" height="12" stroke="white" stroke-width="2"/>
        </svg>
      </div>
      <div id="restore" class="ctrl">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0_9105_112084)">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M8.11108 6H17.2222V15.1111H19.2222V5V4H18.2222H8.11108V6ZM6 10.3333H12.8889V17.2222H6V10.3333ZM4 8.33333H6H12.8889H14.8889V10.3333V17.2222V19.2222H12.8889H6H4V17.2222V10.3333V8.33333Z" fill="white"/>
          </g>
          <defs>
            <clipPath id="clip0_9105_112084">
              <rect width="24" height="24" fill="white"/>
            </clipPath>
          </defs>
        </svg>      
      </div>
      <div id="close" class="ctrl">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z" fill="white"/>
        </svg>
      </div>
    </div>
    `
    }

    #mac () {
      return `
      <style>:host {display: block;}</style>
      <div id=ctrl></div>
      `
    }

    #gen () {
      // linux uses frame atm
      return `
        <style>
          #ctrl {
            user-select: none;
            -webkit-app-region: no-drag;
            display: flex;
            float: right;
            margin-left: .6em;
            margin-top: 0.8em;
            border-spacing: 0.3em 0;
            margin-right: .9em;
          }
          #ctrl > .ctrl {
            opacity: 0.8;
            height: 24px;
            width: 24px;
            display: table-cell;
            vertical-align: middle;
            text-align: center;
            margin-left: .9em;
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
          svg {
            width: 1em;
            height: 1em;
         }
        </style>
        <div id="ctrl">
          <div id="min" class="ctrl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12.998H5V10.998H19V12.998Z" fill="white"/>
            </svg>
          </div>
          <div id="max" class="ctrl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="12" height="12" stroke="white" stroke-width="2"/>
            </svg>
          </div>
          <div id="restore" class="ctrl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_9105_112084)">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8.11108 6H17.2222V15.1111H19.2222V5V4H18.2222H8.11108V6ZM6 10.3333H12.8889V17.2222H6V10.3333ZM4 8.33333H6H12.8889H14.8889V10.3333V17.2222V19.2222H12.8889H6H4V17.2222V10.3333V8.33333Z" fill="white"/>
              </g>
              <defs>
                <clipPath id="clip0_9105_112084">
                  <rect width="24" height="24" fill="white"/>
                </clipPath>
              </defs>
            </svg>      
          </div>
          <div id="close" class="ctrl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z" fill="white"/>
            </svg>
          </div>
        </div>
      `
    }
  })
}

// support for native addons triggering uncaughtExceptions
// process.on('uncaughtException', (err) => { console.error('Uncaught exception detected', err) })
