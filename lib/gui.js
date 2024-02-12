'use strict'
const electron = require('electron')
const { resolve } = require('path')
const unixPathResolve = require('unix-path-resolve')
const { once } = require('events')
const path = require('path')
const { spawn } = require('child_process')
const { TESTING, FORCE_SHOW, ALIASES, IS_MAC, IS_WINDOWS, IS_LINUX } = require('./constants')
const preload = require.main.filename
const kMap = Symbol('pear.gui.map')
const kCtrl = Symbol('pear.gui.ctrl')

class Menu {
  static PEAR = 0
  static APP = 0
  static EDIT = 1
  static DEV = 2
  static WINDOW = 3
  template = [
    IS_MAC ? { label: 'Pear' } : { label: 'App' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        IS_MAC && { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ].filter(Boolean)
    },
    { label: 'Dev' },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(IS_MAC
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : []),
        { role: 'close' }
      ]
    }
  ]

  devtoolsReloaderActive = false
  constructor (app, renderEvents = ['app-register', 'app-deregister', 'app-focus']) {
    this.app = app
    const rerender = () => { this.render() }
    for (const event of renderEvents) electron.app.on(event, rerender)
    this.unlisten = () => {
      for (const event of renderEvents) electron.app.removeListener(event, rerender)
    }
    this.render()
  }

  #pear () {
    const { PEAR } = this.constructor
    const item = this.template[PEAR]
    item.submenu = [
      {
        label: 'Force Platform Shutdown',
        accelerator: 'Ctrl+Alt+Shift+Q',
        click: () => electron.app.quit()
      }
    ]
  }

  #app () {
    const { APP } = this.constructor
    const item = this.template[APP]
    const { app } = this
    item.submenu.unshift(...[
      {
        label: 'Dev Mode',
        type: 'checkbox',
        checked: app.ctx?.dev,
        click: async () => {
          if (app.ctx.dev === true) {
            await app.ctx.update({ dev: false })
            for (const { contentView } of gui.ofSession(app.handle?.session)) {
              await contentView.webContents.closeDevTools()
            }
          } else {
            await app.ctx.update({ dev: true })
          }

          this.render()
        }
      },
      { type: 'separator' },
      {
        get label () {
          let name = app.ctx?.name
          name = name || 'app'
          name = name[0].toUpperCase() + name.slice(1)
          return `Quit ${name}`
        },
        accelerator: 'CmdOrCtrl+Q',
        async click (_, win) {
          if (!win) {
            const devtoolsWc = electron.webContents.getFocusedWebContents()
            if (!devtoolsWc) return // no windows selected at all, nothing to do
            for (const wc of electron.webContents.getAllWebContents()) {
              if (wc.isDevToolsFocused()) {
                win = electron.BrowserWindow.fromWebContents(wc)
                break
              }
            }
          }
          if (!win) return // no windows selected, nothing to do
          const view = win.getBrowserViews()[0]
          const session = view?.webContents.session || win.webContents.session
          for (const ctrl of gui.ofSession(session)) {
            await ctrl.close()
          }
        }
      },
      {
        label: 'hidden decal devtools',
        accelerator: IS_MAC ? 'Alt+Command+U' : 'Ctrl+Shift+U',
        visible: false,
        click (_, win) {
          win?.webContents?.openDevTools({ mode: 'detach' })
        }
      },
      ...(IS_MAC
        ? []
        : [{
            label: 'hidden win devtools',
            accelerator: 'Ctrl+Shift+I',
            visible: false,
            click (_, win) {
              const [view] = win.getBrowserViews()
              view.webContents.openDevTools({ mode: 'detach' })
            }
          }])
    ])

    if (app.handle === null) return
    const setLabel = () => {
      if (!app?.ctx?.name) return
      item.label = app.ctx.name[0].toUpperCase(0) + app.ctx.name.slice(1)
    }
    setLabel()
  }

  #dev () {
    const { DEV } = this.constructor
    const item = this.template[DEV]
    const { app } = this
    if (!app.handle) return
    const { ctx } = app
    const { session } = app.handle
    if (ctx.dev === false) {
      item.visible = false
      return
    }
    const dts = (electron.webContents.getAllWebContents() || [])
      .filter((wc) => {
        if (wc.session !== session) return false
        const url = wc.getURL()
        return url.trim() && (/^devtools:\/\//.test(url) === false)
      })
      .map((wc, ix) => {
        const ch = String.fromCharCode(65 + ix)
        const self = this
        const item = {
          label: wc.getTitle(),
          type: 'checkbox',
          checked: wc.isDevToolsOpened(),
          accelerator: (IS_MAC ? `Alt+Command+Shift+${ch}` : `Ctrl+Alt+Shift+${ch}`),
          click () {
            if (wc.isDestroyed()) {
              self.render()
              return
            }
            if (wc.isDevToolsOpened()) {
              wc.closeDevTools()
              item.checked = false
            } else {
              wc.openDevTools({ mode: 'detach' })
              item.checked = true
            }
          }
        }
        return item
      }, this)

    item.visible = true
    item.submenu = [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click (_, win) {
          const view = win.getBrowserViews()[0]
          const { webContents } = view || win
          refresh(webContents, app.ctx)
        }
      },
      {
        label: 'Force Reload',
        accelerator: 'Shift+CmdOrCtrl+R',
        click (_, win) {
          if (!win) return
          const view = win.getBrowserViews()[0]
          const { webContents } = view || win
          webContents.reloadIgnoringCache() // force reload does not honor app teardown listeners
        }
      },
      {
        label: 'Developer Tools',
        submenu: dts
      },
      {
        label: 'current main view devtools',
        accelerator: IS_MAC ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        visible: false,
        click (_, win) {
          if (!win) return
          const view = win.getBrowserViews()[0]
          const { webContents } = view || win
          if (webContents.isDevToolsOpened()) {
            webContents.closeDevTools()
          } else {
            webContents.openDevTools({ mode: 'detach' })
          }
        }
      }
    ]
  }

  build () {
    this.#pear()
    this.#app()
    this.#dev()
    this.menu = electron.Menu.buildFromTemplate(this.template)
  }

  render () {
    if (electron.webContents.getAllWebContents().length === 0 || this.app.closed) return
    this.build()
    electron.Menu.setApplicationMenu(this.menu)
  }

  devtoolsReloaderListen (wc) {
    if (this.devtoolsReloaderActive) return

    this.devtoolsReloaderActive = true
    const listener = () => { refresh(wc, this.app.ctx) }
    // ignore electron docs about register: it DOES NOT accept an array of accelerators, just the one string
    electron.globalShortcut.register('CommandOrControl+R', listener)
    electron.globalShortcut.register('F5', listener)
  }

  devtoolsReloaderUnlisten () {
    if (this.devtoolsReloaderActive === false) return
    this.devtoolsReloaderActive = false
    electron.globalShortcut.unregister('CommandOrControl+R')
    electron.globalShortcut.unregister('F5')
  }

  destroy () {
    this.menu = null
    this.app = null
    this.unlisten()
    super.destroy()
  }
}

function refresh (webContents, ctx) {
  if (ctx.reloadingSince === 0) {
    webContents.once('did-stop-loading', () => { ctx.reloadingSince = 0 })
    webContents.executeJavaScript('location.reload()', true) // ensures app teardown listeners are triggered
    ctx.reloadingSince = Date.now()
    return
  }
  const max = 5000
  const timegap = Date.now() - ctx.reloadingSince
  if (timegap < max) {
    webContents.executeJavaScript(`console.info('Refresh in progress. Ignoring for another', ${max} - ${timegap}, 'ms')`)
    return
  }

  webContents.once('did-stop-loading', () => {
    webContents.executeJavaScript(`console.warn('Refresh attempt took longer than ${max}ms. This refresh was a force refresh, teardown logic will not have been executed on prior unload.')`)
    ctx.reloadingSince = 0
  })
  webContents.reloadIgnoringCache() // force reload does not honor app teardown listeners
  ctx.reloadingSince = Date.now()
}

class ContextMenu {
  constructor (webContents, { dev } = {}) {
    this.webContents = webContents
    this.dev = dev
    this.x = 0
    this.y = 0
    webContents.once('destroyed', () => this.destroy())
  }

  async popup ({ x = 0, y = 0 } = {}) {
    const items = []

    if (await this.webContents.executeJavaScript(`document.elementFromPoint(${x}, ${y})?.tagName === 'IMG'`)) {
      items.push(new electron.MenuItem({
        label: 'Copy Image',
        click: () => this.webContents.copyImageAt(x, y)
      }))
    }

    if (this.dev) {
      items.push(new electron.MenuItem({
        label: 'Inspect Element',
        click: () => {
          // close and reopen for inspect element click, only way to focus devtools in practice
          this.webContents.closeDevTools()
          this.webContents.openDevTools({ mode: 'detach' })
          this.webContents.inspectElement(x, y)
        }
      }))
    }

    this.menu = electron.Menu.buildFromTemplate(items)
    this.menu.popup()
  }

  close () {
    this.menu.closePopup()
  }

  destroy () {
    this.close()
    this.menu = null
  }
}

electron.app.userAgentFallback = 'Pear Platform'

class App {
  changes = null
  menu = null
  ready = false
  sidecar = null
  ctx = null
  ipc = null
  id = null
  handle = null
  closing = null
  closed = false
  static root = unixPathResolve(resolve(__dirname, '..'))

  constructor (ctx) {
    this.ctx = ctx
    this.contextMenu = null
    electron.app.on('browser-window-focus', () => { this.menu.devtoolsReloaderUnlisten() })

    electron.app.on('child-process-gone', (e, details) => {
      if (details.reason === 'killed') return
      electron.dialog.showErrorBox('A Child Process has crashed', JSON.stringify(details, 0, 2))
    })

    electron.app.on('web-contents-created', (e, wc) => {
      this.menu.render()

      wc.on('devtools-focused', () => {
        this.menu.devtoolsReloaderListen(wc)
      })

      // electron has absolutely no functioning blur event of any kind
      // there is NO WAY in electron to react to devtools blur, so now this is happening:
      let devtoolsBlurPolling = null
      wc.on('devtools-opened', () => {
        devtoolsBlurPolling = setInterval(() => {
          if (this.menu.globalReloaderActive === false) return
          if (wc.isDevToolsFocused() === false) this.menu.devtoolsReloaderUnlisten()
        }, 150)
      })
      wc.on('destroyed', () => {
        this.menu.render()
        clearInterval(devtoolsBlurPolling)
      })
      wc.on('devtools-closed', () => {
        this.menu.devtoolsReloaderUnlisten()
        clearInterval(devtoolsBlurPolling)
        devtoolsBlurPolling = null
      })

      wc.on('context-menu', (e, { x, y }) => {
        const ctrl = gui.fromWebContents(wc)
        if (!ctrl) return
        if ((ctrl.view && ctrl.view.webContents === wc) || (ctrl.view === null && ctrl.win?.webContents === wc)) {
          this.contextMenu = this.contextMenu || new ContextMenu(wc, { dev: this.ctx.dev, x, y })
          this.contextMenu.popup({ x, y })
        }
      })
      wc.on('render-process-gone', async (evt, details) => {
        if (details?.reason === 'killed') return
        if (this.ctx.dev) process._rawDebug('A Render Process has crashed', evt, details)
        else electron.dialog.showErrorBox('A Render Process has crashed', JSON.stringify(details, 0, 2))
        const err = new Error('A Render Process has crashed')
        err.code = 'ERR_CRASH'
        err.info = details
        await this.report({ err })
      })
    })
    this.menu = new Menu(this)
  }

  async report ({ err, upgrade }) {
    err = err?.remote || err || new Error(`Unknown error: "${err}"`)
    const x = '\x1B[31m✖ \x1B[39m'
    const pregui = this.handle === null || this.ipc.open === false
    if (pregui) {
      if (err.code === 'ERR_CONNECTION') {
        console.error(`${x} Connection Error\n   * check network connection\n   * check run key`)
      } else if (err.code === 'ERR_INVALID_KEY') {
        console.error(`${x} ${err.message}`)
      } else {
        console.trace(process.pid, `${x} Platform Initialization`, err)
      }
      process.exit(1)
    }
    try {
      return await this.ipc.request({
        channel: this.ipc.id + ':app:createReport',
        args: [{ message: err.message, stack: err.stack, code: err.code, upgrade }]
      }, this.ipc.id + ':app:createReport')
    } catch (ipcErr) {
      const timedout = ipcErr.name === 'TimeoutError' && ipcErr.code === ipcErr.TIMEOUT_ERR
      if (err?.code === 'ERR_FAILED') {
        console.error('Failed to load app (or app was closed early)')
        return
      }
      if (err.code === 'E_HALTED') return
      if (err) console.error(`${x} Platform`, err)
      else if (err && timedout) return
      if (ipcErr.code === 'E_HALTED') return
      console.error(`${x} Platform IPC`, ipcErr)
    }
  }

  async start (ipc) {
    let changes = () => {}
    this.ipc = ipc

    electron.app.once('will-quit', async (e) => {
      if (this.closing === null && this.closed === false) {
        e.preventDefault()
        await this.close()
        this.quit()
      }
    })

    const { ctx } = this

    this.starting = ipc.start(this, ctx.argv, ctx.env, ctx.cwd, ctx.startId)

    this.starting.catch(async (err) => {
      await this.report({ err })
      this.destroy()
    })

    try {
      if (this.ready === false) {
        await electron.app.whenReady()
        const name = ctx?.name || 'pear'
        this.name = name[0].toUpperCase() + name.slice(1)
        this.allowRendererProcessReuse = false
        this.ready = true
      }

      const testing = this.testing

      const { dev, trace, key, stage } = ctx
      const show = FORCE_SHOW || (!trace && !testing && (dev || !stage))
      const unfilteredGuiOptions = ctx.options.gui || ctx.options
      const guiOptions = {
        autoresize: unfilteredGuiOptions.autoresize, // INTERNAL - for gizmos that are views, TODO: rename to "#autoresize"
        backgroundColor: unfilteredGuiOptions.backgroundColor,
        decal: unfilteredGuiOptions.decal,
        width: unfilteredGuiOptions.width,
        height: unfilteredGuiOptions.height,
        x: unfilteredGuiOptions.x,
        y: unfilteredGuiOptions.y,
        center: unfilteredGuiOptions.center,
        minWidth: unfilteredGuiOptions.minWidth,
        minHeight: unfilteredGuiOptions.minHeight,
        maxWidth: unfilteredGuiOptions.maxWidth,
        maxHeight: unfilteredGuiOptions.maxHeight,
        resizable: unfilteredGuiOptions.resizable,
        movable: unfilteredGuiOptions.movable,
        minimizable: unfilteredGuiOptions.minimizable,
        maximizable: unfilteredGuiOptions.maximizable,
        closable: unfilteredGuiOptions.closable,
        focusable: unfilteredGuiOptions.focusable,
        alwaysOnTop: unfilteredGuiOptions.alwaysOnTop,
        fullscreen: unfilteredGuiOptions.fullscreen,
        kiosk: unfilteredGuiOptions.kiosk,
        autoHideMenuBar: unfilteredGuiOptions.autoHideMenuBar,
        hasShadow: unfilteredGuiOptions.hasShadow,
        opacity: unfilteredGuiOptions.opacity,
        transparent: unfilteredGuiOptions.transparent
      }

      const decalSession = electron.session.fromPartition('persist:pear')

      decalSession.setUserAgent('Pear Platform')

      const entry = '/' + ctx.main
      const identify = await ipc.identify()
      const { id, host } = identify

      this.warming = ctx.trace ? ipc.iterable(`${id}:app:warming`) : null

      ctx.update({ sidecar: host, id, config: ctx.constructor.configFrom(ctx) })
      ipc.setup(id)

      if (this.sidecar === null) this.sidecar = host
      if (this.sidecar !== host) this.sidecar = host

      await gui.ctrl('window', entry, { ctx }, {
        ...guiOptions,
        pearlink (event, url) {
          event.preventDefault()
          const { appling, cwd, env } = ctx
          if (!appling) return
          const opts = { cwd, env, detached: true, stdio: 'ignore' }
          if (process.platform === 'darwin') {
            spawn('open', [appling.path.split('.app')[0] + '.app', '--args', url], opts).unref()
          } else {
            spawn(appling.path, [url], opts).unref()
          }
        },
        afterInstantiation: (app) => {
          this.handle = app
          this.menu.render()
        },
        manualViewReveal: true,
        at: __filename,
        window: {
          show,
          backgroundColor: '#000',
          transparent: true,
          title: (ctx.appling && ctx.appling.name) || undefined,
          icon: (ctx.appling && ctx.appling.icon) || undefined,
          webPreferences: {
            title: `Pear ${ctx.name} (decal)`,
            devTools: true
          }
        },
        view: {
          height: guiOptions.height,
          width: guiOptions.width,
          webPreferences: {
            title: `Pear: ${ctx.name}`,
            devTools: true,
            get backgroundColor () {
              return ctx.options.transparent ? '#00000000' : (ctx.options.backgroundColor || '#FFF')
            }
          }
        },
        afterNativeWindowClose: () => this.close(),
        afterNativeViewCreated: dev && ((app) => {
          if (testing || trace) return
          app.view.webContents.openDevTools({ mode: 'detach' })

          if (app.ctx.chromeWebrtcInternals) gui.chrome('webrtc-internals')
        }),
        afterNativeViewLoaded: (trace
          ? async () => {
            await new Promise((resolve) => setTimeout(resolve, 750)) // time for final blocks to be received
            this.destroy()
            this.quit()
          }
          : (process.platform === 'linux' ? (app) => linuxViewSize(app, app.tbh) : null)),
        interload: async (app) => {
          ctx.update({ top: app.win })
          try {
            if (app.closing) return false
            if (ctx.type === 'commonjs') {
              throw new Error('"type": "commonjs" or no "type" in application package.json. Pear Desktop Applications are native EcmaScript Module (ESM) syntax only (CJS modules can be consumed, but applications must be ESM). To opt into ESM, set the package.json "type" field to "module".')
            }

            const { bail } = await this.starting
            if (bail) return false

            ctx.update({ config: await ipc.request({ channel: `${id}:app:config` }) })

            applyGuiOptions(app.win, ctx.config.options.gui || ctx.config.options, app.tbh)
            if (app.closing) return false
            return true
          } catch (err) {
            await this.report({ err })
            await this.destroy()
            return false
          }
        }
      })

      if (key === null && ctx.options.watch && !ctx.options.watch.disable) { changes = require('./watch.js') }

      await this.starting
      this.starting = null
    } catch (err) {
      await this.report({ err })
      this.destroy()
      return
    }

    try {
      await changes(this.ipc, ctx)
    } catch (err) {
      await this.report({ err })
    }
  }

  async version () {
    const { fork, length, key } = await this.updater.currentVersion()
    return { fork, length, key: key ? key.toString('hex') : null }
  }

  close (maxWait = 5500) {
    if (this.closing) return this.closing
    this.closing = this.#close(maxWait)
    return this.closing
  }

  async #close (maxWait) {
    let clear = null
    const timeout = new Promise((resolve) => {
      const tid = setTimeout(() => resolve(true), maxWait)
      clear = () => {
        clearTimeout(tid)
        resolve(false)
      }
    })

    const unloaders = gui.ctrls().map((ctrl) => {
      const closed = () => ctrl.closed
      if (!ctrl.unload) {
        if (ctrl.unloader) return ctrl.unloader.then(closed, closed)
        return ctrl.close()
      }
      ctrl.unload({ type: 'close' })
      return ctrl.unloader.then(closed, closed)
    })
    const unloading = Promise.all(unloaders)
    unloading.then(clear, clear)
    const result = await Promise.race([timeout, unloading])
    this.closed = true
    return result
  }

  destroy () {
    return this.ipc.close()
  }

  quit (code) {
    return electron.app.quit(code)
  }
}

module.exports = App

function linuxViewSize ({ win, view }, tbh = 0) {
  const [width, height] = win.getSize()
  view.setBounds({ x: 0, y: tbh, width, height: height - tbh })
  view.setAutoResize({
    width: true,
    height: true
  })
}

function applyGuiOptions (win, opts, tbh = 0) {
  for (const [key, value] of groupings(win, opts)) {
    applyGuiOption(win, key, value, tbh)
  }
}

function applyGuiOption (win, key, value, tbh = 0) {
  switch (key) {
    case 'width:height': {
      const [currentWidth, currentHeight] = win.getSize()
      const [curX, curY] = win.getPosition()
      const [width, height] = value
      let x = Math.round(curX - ((width - currentWidth) / 2))
      let y = Math.round(curY - ((height - currentHeight) / 2))
      x = x < 0 ? 0 : x
      y = y < 0 ? 0 : y
      win.setPosition(x, y, true)
      return win.setSize(width, height, true)
    }
    case 'x:y': return win.setPosition(value[0], value[1], true)
    case 'center': return value && win.center()
    case 'minWidth:minHeight': return win.setMinimumSize(...value)
    case 'maxWidth:maxHeight': return win.setMaximumSize(...value)
    case 'resizable': return win.setResizable(value)
    case 'movable': return win.setMovable(value)
    case 'minimizable': return win.setMinimizable(value)
    case 'maximizable': return win.setMaximizable(value)
    case 'closable': return win.setClosable(value)
    case 'focusable': return win.setFocusable(value)
    case 'alwaysOnTop': return win.setAlwaysOnTop(value)
    case 'fullscreen': {
      win.setFullScreen(value)
      win.once('enter-full-screen', () => {
        const { width, height } = win.getBounds()
        const [view] = win.getBrowserViews()
        view.setBounds({ x: 0, y: tbh, width, height: height - tbh })
      })
      return
    }
    case 'kiosk': return win.setKiosk(value)
    case 'autoHideMenuBar': return win.setAutoHideMenuBar(value)
    case 'hasShadow': return win.setHasShadow(value)
    case 'opacity': return win.setOpacity(value)
    case 'transparent': {
      // changing the size is a hack that forces electron
      // to behave when it comes to transparency
      const [w, h] = win.getSize()
      win.setSize(w, h - 1, false)
      win.setSize(w, h, false)
      return value ? win.setBackgroundColor('#00000000') : win.setBackgroundColor('#000')
    }
  }
}

function group (win, opts, seen, key, value, index, counterpart, getter) {
  const tuple = win[getter]()
  tuple[index] = value
  if (counterpart in opts) tuple[1 - index] = opts[counterpart]
  seen.add(counterpart)
  const join = index === 0 ? `${key}:${counterpart}` : `${counterpart}:${key}`
  return [join, tuple]
}

function * groupings (win, opts) {
  const seen = new Set(['webPreferences'])
  const priority = ['center', 'fullscreenable']
  const entries = Object.entries(opts).sort(([a], [b]) => priority.indexOf(b) - priority.indexOf(a))
  for (const [key, value] of entries) {
    if (seen.has(key)) continue
    if (key === 'width') yield group(win, opts, seen, key, value, 0, 'height', 'getSize')
    else if (key === 'height') yield group(win, opts, seen, key, value, 1, 'width', 'getSize')
    else if (key === 'x') yield group(win, opts, seen, key, value, 0, 'y', 'getPosition')
    else if (key === 'y') yield group(win, opts, seen, key, value, 1, 'x', 'getPosition')
    else if (key === 'minWidth') yield group(win, opts, seen, key, value, 0, 'minHeight', 'getMinimumSize')
    else if (key === 'minHeight') yield group(win, opts, seen, key, value, 1, 'minWidth', 'getMinimumSize')
    else if (key === 'maxWidth') yield group(win, opts, seen, key, value, 0, 'maxHeight', 'getMaximumSize')
    else if (key === 'maxHeight') yield group(win, opts, seen, key, value, 1, 'maxWidth', 'getMaximumSize')
    else yield [key, value]
  }
}

const idify = (instance) => {
  const { view, win } = instance
  if (!win && !view) return false
  const { webContents } = view || win
  return webContents.id
}

const DEF_BG = '#1F2430'
const noop = () => {}

class GuiCtrl {
  [kCtrl] = null
  win = null
  view = null
  id = null
  unload = null
  unloader = null
  unloaded = null
  appkin = null
  static height = 540
  static width = 720
  static [kCtrl] = null
  static [kMap] = new Map()

  constructor (entry, options, { ctx, parentId, ua, sessname, appkin }) {
    this.hidden = false
    this[kCtrl] = this.constructor[kCtrl]
    if (!entry) throw new Error(`No path provided, cannot open ${this[kCtrl]}`)
    this.options = options
    this.ctx = ctx
    this.parentId = parentId
    this.closed = true
    this.id = null
    this.sidecar = this.ctx.sidecar
    this.entry = `${this.sidecar}${entry}`
    this.ua = ua
    this.sessname = sessname
    this.appkin = appkin
    if (ALIASES.keet.z32 === this.ctx.key?.z32) this.tbh = 0
    else this.tbh = this.ctx.options.platform?.__legacyTitlebar ? 48 : 0
  }

  get session () {
    return this.view ? this.view.webContents.session : (this.win ? this.win.webContents.session : null)
  }

  get contentView () {
    return this.view ? this.view : (this.win ? this.win : null)
  }

  get title () {
    return this.contentView?.webContents?.getTitle() || this.entry
  }

  nav = (event, url) => {
    if (url.startsWith(this.sidecar)) return
    if (this.pearlink && url.startsWith('pear:')) return this.pearlink(event, url)
    event.preventDefault()
    electron.shell.openExternal(url)
  }

  open () {
    const handler = (wc) => ({ url }) => {
      if (url.startsWith(this.sidecar)) {
        wc.executeJavaScript(`console.error('Pear: Improper use of window.open (ignoring "${url}").\\n 👉 Pear window.open exclusively opens external URLs in default browser.\\n 💡 To open application windows or view, use pear/gui')`).catch(noop)
        return
      }
      electron.shell.openExternal(url)
      return { action: 'deny' }
    }
    this.win?.webContents.setWindowOpenHandler(handler(this.win.webContents))
    this.win?.webContents.on('will-navigate', this.nav)
    this.view?.webContents.setWindowOpenHandler(handler(this.view.webContents))
    this.view?.webContents.on('will-navigate', this.nav)
  }

  async focus ({ steal = false } = {}) {
    if (this.closed) return false
    if (this.win.isFocused()) return true
    if (steal) electron.app.focus({ steal: true })

    const focused = once(this.win, 'focus')
    const result = this.win.focus()
    await focused
    return result
  }

  async blur () {
    if (this.closed) return false
    if (!this.win.isFocused()) return true
    const focused = once(this.win, 'blur')
    const result = this.win.blur()
    await focused
    return result
  }

  async send (...args) {
    if (this.closed) throw Error(`Cannot send to closed ${this[kCtrl]}`)
    const { webContents } = this.view || this.win
    return webContents.send(`message:${this.id}`, ...args)
  }

  async isClosed () {
    if (this.closed) return true
    this.closed = !!(this.win && this.win.closed)
    return this.closed
  }

  async close () {
    if (this.closed) return true
    if (this.unload) {
      this.unload({ type: 'close' })
      await this.unloader
    }
    let closer = null
    if (this.win) {
      closer = once(this.win, 'closed')
      this.win.close()
    }
    await closer
    this.constructor[kMap].delete(this.id)
    this.id = null
    this.win = null
    this.view = null
    this.closed = true
    return this.closed
  }

  async show () {
    if (this.closed) return false
  }

  async hide () {
    if (this.closed) return false
  }

  async getMediaSourceId () {
    if (this.closed) throw Error(`Cannot get media source id if the ${this[kCtrl]} is closed`)
    return (this.win && this.win.getMediaSourceId())
  }

  async dimensions (opts = null) {
    if (this.closed) return null
    const item = this[kCtrl] === 'view' ? this.view : this.win
    const bounds = item.getBounds()
    if (opts === null) return bounds
    const {
      x = bounds.x, y = bounds.y, width = bounds.width, height = bounds.height, animate, position
    } = opts
    item.setBounds({ x, y, width, height }, animate)
    if (position === 'center' && this[kCtrl] === 'win') {
      // TODO: support centering of views
      // TODO: support other positions: tl, tr, cl, cr, cl, br, tm, bm
      // TODO: possibly support relative positions to parent: position: { x: -200, y: 500 }
      item.center()
    }
  }

  fullscreen () { return false }
  maximize () { return false }
  minimize () { return false }
  isMaximized () { return false }
  isMinimized () { return false }
  isFullscreen () { return false }
  isVisible () { return !this.hidden }

  async unloading () {
    const { webContents } = (this.view || this.win)
    const until = new Promise((resolve) => { this.unload = resolve })
    webContents.once('will-navigate', (e, url) => {
      if (!url.startsWith(this.sidecar)) return // handled by the other will-navigate handler
      e.preventDefault()
      const type = (!e.frame || e.frame.url === url) ? 'reload' : 'nav'
      this.unload({ type, url })
    })

    const closeListener = (e) => {
      e.preventDefault()
      if (this.unload) {
        this.unload({ type: 'close' })
      }
    }
    if (this.win) this.win.once('close', closeListener)
    this.unloader = new Promise((resolve) => { this.unloaded = resolve })
    const action = await until
    if (this.win) this.win.removeListener('close', closeListener)
    this.unload = null
    return action
  }

  completeUnload (action) {
    this.unloaded()
    if (action.type === 'close') this.close()
  }

  setWindowButtonPosition (point) {
    if (!this.win) return
    this.win.setWindowButtonPosition(point)
  }

  setWindowButtonVisibility (visible) {
    if (!this.win) return
    this.win.setWindowButtonVisibility(visible)
  }
}

class Window extends GuiCtrl {
  static [kCtrl] = 'window'
  decalId = null
  closing = false
  #viewInitialized = null
  #viewLoaded = null
  async open (opts = {}) {
    if (this.win) return !this.closed
    this.opening = true
    const { BrowserWindow, BrowserView } = electron
    const options = { ...this.options, ...opts }
    const { decal = true, interload, manualViewReveal = false, pearlink = null } = options
    this.pearlink = pearlink
    let viewInitialized = null
    let viewLoaded = null
    this.#viewInitialized = new Promise((resolve) => { viewInitialized = resolve })
    this.#viewLoaded = new Promise((resolve) => { viewLoaded = resolve })
    if (this.appkin) {
      this.ctx = await this.appkin
      this.appkin = null
    }
    const ua = this.ua || `Pear ${this.ctx.id}`
    const session = electron.session.fromPartition(`persist:${this.sessname || this.ctx.key?.z32 || this.ctx.cwd}`)
    session.setUserAgent(ua)

    const { show = true } = TESTING ? { show: FORCE_SHOW } : { show: (options.show || options.window?.show) }
    const { height = this.constructor.height, width = this.constructor.width } = options
    this.win = new BrowserWindow({
      ...(options.window || options),
      height,
      width,
      frame: !(IS_MAC || IS_WINDOWS || (IS_LINUX && TESTING)), // testing as it works around a linux bug when frame is used with bounds
      ...(IS_MAC && this.ctx.options.platform?.__legacyTitlebar ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 12, y: 16 }, titleBarOverlay: true } : (IS_MAC ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 0, y: 0 }, titleBarOverlay: true } : {})),
      ...(IS_WINDOWS && this.ctx?.alias === 'keet' && this.ctx?.appling?.path ? { icon: path.join(path.dirname(this.ctx.appling.path), 'resources', 'app', 'icon.ico') } : {}),
      show,
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload,
        ...(decal === false ? { session } : {}),
        partition: 'persist:pear',
        additionalArguments: [JSON.stringify({ ...this.ctx.config, isDecal: true })],
        autoHideMenuBar: true,
        experimentalFeatures: true,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        nodeIntegrationInSubFrames: false,
        enableRemoteModule: false,
        contextIsolation: false,
        webSecurity: false,
        nativeWindowOpen: true
      }
    })
    this.win.setWindowButtonVisibility(false) // configured by <pear-ctrl>
    this.hidden = !show

    this.win.on('focus', () => {
      if (this?.view?.webContents) this.view.webContents.focus()
    })

    this.win.on('close', () => {
      this.closing = true
    })

    this.win.on('closed', () => {
      if (typeof options.afterNativeWindowClose === 'function') {
        options.afterNativeWindowClose(this)
      }
      if (this.win) {
        if (this.opening) this.opening = false
        this.win.closed = true
        this.closed = true
        this.win = null
        this.view = null
      }
    })

    if (decal === false) {
      if (this.id === null) this.id = idify(this)
      this.constructor[kMap].set(this.id, this)
      await this.win.loadURL(this.entry)
      this.opening = false
      this.closed = false
      return !this.closed
    }
    if (this.decalId === null) this.decalId = idify(this)
    this.constructor[kMap].set(this.decalId, this)
    this.closed = false
    this.win.setMenuBarVisibility(false)
    if (IS_MAC === false) this.win.setAutoHideMenuBar(true)

    const decalUrl = `${this.sidecar}/decal.html`
    const decalLoading = this.win.loadURL(decalUrl)

    if (interload && (await interload(this)) === false) return false

    if (this.closing) return false

    this.view = new BrowserView({
      ...(options.view || options),
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload,
        session,
        additionalArguments: [JSON.stringify({ ...this.ctx.config, parentWcId: this.win.webContents.id, decalled: true })],
        autoHideMenuBar: true,
        experimentalFeatures: true,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        nodeIntegrationInSubFrames: false,
        enableRemoteModule: false,
        contextIsolation: false,
        webSecurity: false, // disable CORS
        nativeWindowOpen: true
      }
    })

    if (options.afterNativeViewCreated) options.afterNativeViewCreated(this)
    this.view.setBounds({ x: 0, y: this.tbh, width, height: height - this.tbh })
    const viewLoading = this.view.webContents.loadURL(this.entry)
    viewInitialized()
    this.view.webContents.once('did-finish-load', () => { viewLoaded() })

    if (this.id === null) {
      this.id = idify(this)
      this.constructor[kMap].set(this.id, this)
    }

    await decalLoading
    if (this.closing) return false
    await viewLoading
    if (manualViewReveal === false) this.attachMainView()

    if (this.closing) return false

    if (typeof options.afterNativeViewLoaded === 'function') await options.afterNativeViewLoaded(this)

    if (this.closing) return false

    this.opening = false

    this.win?.on('resize', (e) => {
      e.preventDefault()
      setImmediate(() => { this.view.setBounds(this.view.getBounds()) })
    })

    super.open()
    return !this.closed
  }

  async attachMainView () {
    await this.#viewInitialized
    this.win.setBrowserView(this.view)
    const { width, height } = this.win.getBounds()
    this.view.setBounds({ x: 0, y: this.tbh, width, height: height - this.tbh })
    this.view.setAutoResize({
      width: true,
      height: true
    })
    this.win.focusOnWebView()
  }

  async detachMainView () {
    if (!this.win) return
    this.win.setBrowserView(null)
  }

  async afterViewLoaded () {
    await this.#viewLoaded
  }

  async minimize () {
    if (this.isMinimized()) return true
    const minimized = once(this.win, 'minimize')
    const result = this.win.minimize()
    await minimized
    return result
  }

  async maximize () {
    if (this.isMaximized()) return true
    const maximized = once(this.win, 'maximize')
    const result = this.win.maximize()
    await maximized
    return result
  }

  async fullscreen () {
    if (this.isFullscreen()) return true
    const fullscreen = once(this.win, 'enter-full-screen')
    const result = this.win.setFullScreen(true)
    await fullscreen
    const { width, height } = this.win.getBounds()
    const [view] = this.win.getBrowserViews()
    view.setBounds({ x: 0, y: this.tbh, width, height: height - this.tbh })
    return result
  }

  isMinimized () {
    return this.win ? this.win.isMinimized() : false
  }

  isMaximized () {
    return this.win ? this.win.isMaximized() : false
  }

  isFullscreen () {
    return this.win ? this.win.isFullScreen() : false
  }

  async restore () {
    if (this.isMinimized()) {
      const restored = once(this.win, 'restore')
      const result = this.win.restore()
      await restored
      return result
    }
    if (this.isMaximized()) {
      const unmaximized = once(this.win, 'unmaximize')
      const result = this.win.unmaximize()
      await unmaximized
      return result
    }
    if (this.isFullscreen()) {
      const windowed = once(this.win, 'leave-full-screen')
      const result = this.win.setFullScreen(false)
      await windowed
      return result
    }
    return false
  }

  async show () {
    try {
      if (this.win.isVisible()) return
      const shown = once(this.win, 'show')
      const result = this.win.show()
      return (this.win.isVisible()) ? result : shown.then(() => result)
    } finally { this.hidden = false }
  }

  async hide () {
    try {
      if (!this.win || !this.win.isVisible()) return
      const hidden = once(this.win, 'hide')
      const result = this.win.hide()
      return (!this.win.isVisible()) ? result : hidden.then(() => result)
    } finally { this.hidden = true }
  }

  async close () {
    this.closing = true
    const closed = await super.close()
    this.closing = false
    return closed
  }
}

class View extends GuiCtrl {
  static [kCtrl] = 'view'
  lastOpenOptions = {}
  get hidden () {
    if (!this.win) return false
    const views = new Set(this.win.getBrowserViews())
    return views.has(this.view) === false
  }

  set hidden (v) {} // required syntactically, not required for our purposes
  async open (opts = {}) {
    if (this.view) return !this.closed
    const { BrowserWindow, BrowserView, webContents } = electron
    this.lastOpenOptions = opts
    const options = { ...this.options, ...this.lastOpenOptions }

    const wc = webContents.fromId(this.parentId)
    this.win = BrowserWindow.fromWebContents(wc)
    if (!this.win) {
      await new Promise(setImmediate)
      return this.open(opts)
    }
    if (this.appkin) {
      this.ctx = await this.appkin
      this.appkin = null
    }
    const ua = this.ua || `Pear ${this.ctx.id}`
    const session = electron.session.fromPartition(`persist:${this.sessname || this.ctx.key?.z32 || this.ctx.cwd}`)
    session.setUserAgent(ua)

    this.view = new BrowserView({
      ...(options?.view || options),
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload,
        session,
        additionalArguments: [JSON.stringify({ ...this.ctx.config, ...(options?.view?.config || options.config || {}), parentWcId: this.win.webContents.id })],
        autoHideMenuBar: true,
        experimentalFeatures: true,
        nodeIntegration: true,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        enableRemoteModule: false,
        contextIsolation: false,
        nativeWindowOpen: true
      }
    })

    if (this.id === null) {
      this.id = idify(this)
      this.constructor[kMap].set(this.id, this)
    }
    await this.view.webContents.loadURL(this.entry)

    if (typeof options.afterNativeViewLoaded === 'function') await options.afterNativeViewLoaded(this)

    this.closed = false
    const { show = true } = options
    if (show) this.win.addBrowserView(this.view)
    this.#bounds(options)
    this.win.focusOnWebView()
    super.open()
    return !this.closed
  }

  #bounds (options) {
    const bounds = this.win.getBounds()
    const adjustedHeight = bounds.height - this.tbh
    const { width = bounds.width, height = adjustedHeight } = options
    let { x = 0, y = this.tbh } = options
    if (x < 0 || Object.is(x, -0)) x = bounds.width + x // subtraction, x is negative
    if (y < 0 || Object.is(y, -0)) y = adjustedHeight + y // subtraction, y is negative

    this.view.setBounds({ x, y, width, height })

    if (options.autoresize) {
      this.autoresize = options.autoresize
      const { width = true, height = true, vertical = false, horizontal = false } = options.autoresize
      this.view.setAutoResize({ width, height, vertical, horizontal })
    }
  }

  async show () {
    const result = this.hidden && this.win.addBrowserView(this.view)
    this.#bounds({ ...this.options, ...this.lastOpenOptions })
    this.win.focusOnWebView()
    return result
  }

  async focus (opts) {
    await super.focus(opts)
    const result = this.view.webContents.focus()
    if (this.view.webContents.isFocused()) return result
    await once(this.view.webContents, 'focus')
    return result
  }

  async blur () {
    if (this.view.webContents.isFocused() === false) return true

    // NOTE: `this.win.blurWebView()` is not a viable alternative.
    //       Might seem like it is. It is not. The blur event won't fire.
    //       It's probably to do with the issue of *which* view is blurred.
    //       Also, there is no webContents.blur (v21.2.0 & down for sure)
    //       The following does the trick:
    this.win.blur()
    this.win.focus()

    return this.view.webContents.isFocused() === false
  }

  async hide () {
    return this.hidden === false && this.win && this.win.removeBrowserView(this.view)
  }

  isClosed () {
    return this.closed
  }

  async close () {
    if (this.view && !this.closed) try { this.win.removeBrowserView(this.view) } catch {}
    this.win = null // detach from parent window
    return super.close()
  }
}

const gui = {
  App,
  View,
  Window,
  async ctrl (type, entry, { ctx, parentId = 0, ua, sessname, appkin }, options = {}, openOptions = {}) {
    if (entry.slice(0, 2) === './') entry = entry.slice(1)
    if (entry[0] !== '/') entry = `/~${entry}`
    const state = { ctx, parentId, ua, sessname, appkin }
    const instance = type === 'view' ? new View(entry, options, state) : new Window(entry, options, state)
    if (typeof options.afterInstantiation === 'function') await options.afterInstantiation(instance)

    await instance.open(openOptions)

    return instance
  },
  get (id) {
    const instance = GuiCtrl[kMap].get(id)
    if (!instance) {
      return {
        ghost: true,
        close () { return false },
        show () { return false },
        hide () { return false },
        focus () { return false },
        blur () { return false },
        getMediaSourceId () { return -1 },
        dimensions () { return null },
        maximize () { return false },
        minimize () { return false },
        isVisible () { return false },
        isMaximized () { return false },
        isMinimized () { return false },
        isClosed () { return true },
        unloading () { },
        completeUnload () { }
      }
    }
    return instance
  },
  has (id) { return GuiCtrl[kMap].has(id) },
  ctrls () { return Array.from(GuiCtrl[kMap].values()) },
  fromWebContents (wc) {
    for (const [, ctrl] of GuiCtrl[kMap]) {
      if (ctrl.view?.webContents === wc || ctrl.win?.webContents === wc) return ctrl
    }
    return null
  },
  ofSession (session) {
    return Array.from(GuiCtrl[kMap].values()).filter((ctrl) => ctrl.session === session)
  },
  ofContext (ctx) {
    return Array.from(GuiCtrl[kMap].values()).filter((ctrl) => ctrl.ctx === ctx)
  },
  reportMode (ctx) {
    const ctrls = gui.ofContext(ctx)
    for (const ctrl of ctrls) if (ctrl.detachMainView) ctrl.detachMainView()
  },
  chrome (name) {
    const win = new electron.BrowserWindow({ show: true })
    win.loadURL('chrome://' + name)
  }
}

module.exports = gui
