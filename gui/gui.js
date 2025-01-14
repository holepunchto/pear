'use strict'
const electron = require('electron')
const { resolve } = require('path')
const unixPathResolve = require('unix-path-resolve')
const { once } = require('events')
const path = require('path')
const { isMac, isLinux, isWindows } = require('which-runtime')
const hypercoreid = require('hypercore-id-encoding')
const IPC = require('pear-ipc')
const ReadyResource = require('ready-resource')
const Worker = require('../lib/worker')
const constants = require('../constants')
const kMap = Symbol('pear.gui.map')
const kCtrl = Symbol('pear.gui.ctrl')

class Menu {
  static PEAR = 0
  static APP = 0
  static EDIT = 1
  static DEV = 2
  static WINDOW = 3
  template = [
    isMac ? { label: 'Pear' } : { label: 'App' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        isMac && { role: 'pasteAndMatchStyle' },
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
        ...(isMac
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
        checked: app.state?.devtools,
        click: async () => {
          if (app.state.devtools === true) {
            await app.state.update({ devtools: false })
            for (const { contentView } of PearGUI.ofSession(app.handle?.session)) {
              await contentView.webContents.closeDevTools()
            }
          } else {
            await app.state.update({ devtools: true })
          }

          this.render()
        }
      },
      { type: 'separator' },
      ...(isMac
        ? [{
            get label () {
              let name = app.state?.name
              name = name || 'app'
              name = name[0].toUpperCase() + name.slice(1)
              return `Hide ${name}`
            },
            role: 'hide'
          },
          { type: 'separator' }]
        : []),
      {
        get label () {
          let name = app.state?.name
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
          for (const ctrl of PearGUI.ofSession(session)) {
            ctrl.quitting = true
            await ctrl.close()
          }
        }
      },
      {
        label: 'hidden decal devtools',
        accelerator: isMac ? 'Alt+Command+U' : 'Ctrl+Shift+U',
        visible: false,
        click (_, win) {
          win?.webContents?.openDevTools({ mode: 'detach' })
        }
      },
      ...(isMac
        ? []
        : [{
            label: 'hidden win devtools',
            accelerator: 'Ctrl+Shift+I',
            visible: false,
            click (_, win) {
              const [view] = win.getBrowserViews()
              if (!view) return
              view.webContents.openDevTools({ mode: 'detach' })
            }
          }])
    ])

    if (app.handle === null) return
    const setLabel = () => {
      if (!app?.state?.name) return
      item.label = app.state.name[0].toUpperCase(0) + app.state.name.slice(1)
    }
    setLabel()
  }

  #dev () {
    const { DEV } = this.constructor
    const item = this.template[DEV]
    const { app } = this
    if (!app.handle) return
    const { state } = app
    const { session } = app.handle
    if (state.devtools === false) {
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
          accelerator: (isMac ? `Alt+Command+Shift+${ch}` : `Ctrl+Alt+Shift+${ch}`),
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
          refresh(webContents, app.state)
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
        accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
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
    const listener = () => { refresh(wc, this.app.state) }
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

function refresh (webContents, state) {
  if (state.reloadingSince === 0) {
    webContents.once('did-stop-loading', () => { state.reloadingSince = 0 })
    webContents.executeJavaScript('location.reload()', true) // ensures app teardown listeners are triggered
    state.reloadingSince = Date.now()
    return
  }
  const max = 5000
  const timegap = Date.now() - state.reloadingSince
  if (timegap < max) {
    webContents.executeJavaScript(`console.info('Refresh in progress. Ignoring for another', ${max} - ${timegap}, 'ms')`)
    return
  }

  webContents.once('did-stop-loading', () => {
    webContents.executeJavaScript(`console.warn('Refresh attempt took longer than ${max}ms. This refresh was a force refresh, teardown logic will not have been executed on prior unload.')`)
    state.reloadingSince = 0
  })
  webContents.reloadIgnoringCache() // force reload does not honor app teardown listeners
  state.reloadingSince = Date.now()
}

class ContextMenu {
  constructor (webContents) {
    this.webContents = webContents
    webContents.once('destroyed', () => this.destroy())
  }

  async popup ({ params, devtools = false }) {
    const items = []

    const {
      editFlags: { canPaste },
      isEditable,
      selectionText,
      x = 0,
      y = 0
    } = params

    if (await this.webContents.executeJavaScript(`document.elementFromPoint(${x}, ${y})?.tagName === 'IMG'`)) {
      items.push(new electron.MenuItem({
        label: 'Copy Image',
        click: () => this.webContents.copyImageAt(x, y)
      }))
    } else if (selectionText) {
      items.push(new electron.MenuItem({
        label: 'Copy',
        click: () => this.webContents.copy()
      }))
    }

    if (canPaste && isEditable) {
      items.push(new electron.MenuItem({
        label: 'Paste',
        click: () => this.webContents.paste()
      }))
    }

    if (devtools) {
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

    if (items.length > 0) {
      this.menu = electron.Menu.buildFromTemplate(items)
      this.menu.popup()
    }
  }

  close () {
    this.menu?.closePopup()
  }

  destroy () {
    this.close()
    this.menu = null
  }
}

class App {
  menu = null
  sidecar = null
  state = null
  ipc = null
  id = null
  handle = null
  closing = null
  closed = false
  appReady = false
  static root = unixPathResolve(resolve(__dirname, '..'))

  constructor (gui) {
    const { state, ipc } = gui
    this.gui = gui
    this.state = state
    this.ipc = ipc
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

      wc.on('context-menu', (e, params) => {
        const ctrl = PearGUI.fromWebContents(wc)
        if (!ctrl) return
        if ((ctrl.view && ctrl.view.webContents === wc) || (ctrl.view === null && ctrl.win?.webContents === wc)) {
          this.contextMenu = this.contextMenu || new ContextMenu(wc)
          this.contextMenu.popup({ params, devtools: this.state.devtools })
        }
      })
      wc.on('render-process-gone', async (evt, details) => {
        if (details?.reason === 'killed' || details?.reason === 'clean-exit') return
        if (this.state.dev) process._rawDebug('A Render Process has gone', evt, details)
        else electron.dialog.showErrorBox('A Render Process has gone', JSON.stringify(details, 0, 2))
        const err = new Error('A Render Process has gone')
        err.code = 'ERR_CRASH'
        err.info = details
        await this.report({ err })
      })
    })
    this.menu = new Menu(this)
  }

  async report ({ err }) {
    err = err?.remote || err || new Error(`Unknown error: "${err}"`)
    const x = '\x1B[31m✖ \x1B[39m'
    const pregui = this.handle === null || this.open === false
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
      return await this.ipc.createReport({ message: err.message, stack: err.stack, code: err.code })
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

  async start () {
    electron.app.once('will-quit', async (e) => {
      if (this.closing === null && this.closed === false) {
        e.preventDefault()
        await this.close()
        this.quit()
      }
    })

    electron.app.on('app-exit', () => {
      electron.app.exit()
    })

    const { state } = this

    this.starting = this.ipc.start({
      startId: state.startId,
      args: state.args,
      flags: state.flags,
      env: state.env,
      dir: state.dir,
      link: state.link,
      cmdArgs: process.argv.slice(1)
    })

    this.starting.catch(async (err) => {
      await this.report({ err })
      this.close()
    })

    try {
      if (this.appReady === false) {
        await electron.app.whenReady()
        const name = state?.name || 'pear'
        this.name = name[0].toUpperCase() + name.slice(1)
        this.appReady = true
      }

      const { dev, devtools, stage } = state
      const show = (dev || !stage)
      const unfilteredGuiOptions = state.options.gui || state.options

      const guiOptions = {
        autoresize: unfilteredGuiOptions.autoresize,
        backgroundColor: unfilteredGuiOptions.backgroundColor,
        decal: unfilteredGuiOptions.decal,
        width: parseConfigNumber(unfilteredGuiOptions.width, 'gui.width'),
        height: parseConfigNumber(unfilteredGuiOptions.height, 'gui.height'),
        x: parseConfigNumber(unfilteredGuiOptions.x, 'gui.x'),
        y: parseConfigNumber(unfilteredGuiOptions.y, 'gui.y'),
        center: unfilteredGuiOptions.center,
        minWidth: parseConfigNumber(unfilteredGuiOptions.minWidth, 'gui.minWidth'),
        minHeight: parseConfigNumber(unfilteredGuiOptions.minHeight, 'gui.minHeight'),
        maxWidth: parseConfigNumber(unfilteredGuiOptions.maxWidth, 'gui.maxWidth'),
        maxHeight: parseConfigNumber(unfilteredGuiOptions.maxHeight, 'gui.maxHeight'),
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
        transparent: unfilteredGuiOptions.transparent,
        hideOnClose: unfilteredGuiOptions.hideOnClose ?? unfilteredGuiOptions[process.platform]?.hideOnClose ?? false
      }

      const decalSession = electron.session.fromPartition('persist:pear')

      decalSession.setUserAgent('Pear Platform')
      const entry = state.entrypoint || '/' + state.main
      const identify = await this.ipc.identify({ startId: state.startId })
      const { id, host } = identify

      state.update({ sidecar: host, id, config: state.constructor.configFrom(state) })
      this.ipc.id = id

      if (this.sidecar === null) this.sidecar = host
      if (this.sidecar !== host) this.sidecar = host

      const ctrl = await PearGUI.ctrl('window', entry, { state }, {
        ...guiOptions,
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
          title: (state.appling && state.appling.name) || undefined,
          icon: (state.appling && state.appling.icon) || undefined,
          webPreferences: {
            title: `Pear ${state.name} (decal)`,
            devTools: true
          }
        },
        view: {
          height: guiOptions.height,
          width: guiOptions.width,
          webPreferences: {
            title: `Pear: ${state.name}`,
            devTools: true,
            get backgroundColor () {
              return state.options.transparent ? '#00000000' : (state.options.backgroundColor || '#FFF')
            }
          }
        },
        afterNativeWindowClose: () => this.close(),
        afterNativeViewCreated: devtools && ((app) => {
          app.view.webContents.openDevTools({ mode: 'detach' })
          if (app.state.chromeWebrtcInternals) PearGUI.chrome('webrtc-internals')
        }),
        afterNativeViewLoaded: isLinux ? (app) => linuxViewSize(app) : null,
        interload: async (app) => {
          state.update({ top: app.win })
          try {
            if (app.closing) return false
            if (state.type === 'commonjs') {
              throw new Error('"type": "commonjs" or no "type" in application package.json. Pear Desktop Applications are native EcmaScript Module (ESM) syntax only (CJS modules can be consumed, but applications must be ESM). To opt into ESM, set the package.json "type" field to "module".')
            }

            const { bail } = await this.starting
            if (bail) return false
            state.update({ config: await this.ipc.config() })
            applyGuiOptions(app.win, state.config.options.gui || state.config.options)
            if (app.closing) return false
            return true
          } catch (err) {
            await this.report({ err })
            await this.close()
            return false
          }
        }
      })
      this.id = ctrl.id
      await this.starting
    } catch (err) {
      await this.report({ err })
      this.close()
    } finally {
      this.starting = null
    }
  }

  async version () {
    const { fork, length, key } = await this.updater.currentVersion()
    return { fork, length, key: key ? key.toString('hex') : null }
  }

  unloading () { return this.ipc.unloading() }

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
    const pipes = [...this.gui.pipes]
    const closingPipes = pipes.map((pipe) => new Promise((resolve) => { pipe.once('close', resolve) }))
    const unloaders = [...closingPipes, ...PearGUI.ctrls().map((ctrl) => {
      const closed = () => ctrl.closed
      if (!ctrl.unload) {
        if (ctrl.unloader) return ctrl.unloader.then(closed, closed)
        return ctrl.close()
      }
      ctrl.unload({ type: 'close' })
      return ctrl.unloader.then(closed, closed)
    })]
    for (const pipe of pipes) pipe.end()
    const unloading = Promise.all(unloaders)
    unloading.then(clear, clear)
    const result = await Promise.race([timeout, unloading])
    this.closed = true
    return result
  }

  quit (code) {
    return electron.app.quit(code)
  }
}

function linuxViewSize ({ win, view }) {
  const [width, height] = win.getSize()
  view.setBounds({ x: 0, y: 0, width, height })
  view.setAutoResize({
    width: true,
    height: true
  })
}

function applyGuiOptions (win, opts) {
  for (const [key, value] of groupings(win, opts)) {
    applyGuiOption(win, key, value)
  }
}

function applyGuiOption (win, key, value) {
  switch (key) {
    case 'width:height': {
      const [currentWidth, currentHeight] = win.getSize()
      const [curX, curY] = win.getPosition()
      const [width, height] = value
      let x = Math.round(curX - ((width - currentWidth) / 2))
      let y = Math.round(curY - ((height - currentHeight) / 2))
      x = x < 0 ? 0 : x
      y = y < 0 ? 0 : y
      try { win.setPosition(x, y, true) } catch { /* ignore */ }
      return win.setSize(parseConfigNumber(width, 'gui.width'), parseConfigNumber(height, 'gui.height'), true)
    }
    case 'x:y': return win.setPosition(value[0], value[1], true)
    case 'center': return value && win.center()
    case 'minWidth:minHeight': return win.setMinimumSize(parseConfigNumber(value[0], 'gui.minWidth'), parseConfigNumber(value[1], 'gui.minHeight'))
    case 'maxWidth:maxHeight': return win.setMaximumSize(parseConfigNumber(value[0], 'gui.maxWidth'), parseConfigNumber(value[1], 'gui.maxHeight'))
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
        view.setBounds({ x: 0, y: 0, width, height })
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
  #unloading = null
  appkin = null
  quitting = false
  static height = 540
  static width = 720
  static [kCtrl] = null
  static [kMap] = new Map()

  constructor (entry, options, { state, parentId, sessname, appkin }) {
    this.hidden = false
    this[kCtrl] = this.constructor[kCtrl]
    if (!entry) throw new Error(`No path provided, cannot open ${this[kCtrl]}`)
    this.options = options
    this.state = state
    this.parentId = parentId
    this.closed = true
    this.id = null
    this.sidecar = this.state.sidecar
    this.entry = `${this.sidecar}${entry}`
    this.sessname = sessname
    this.appkin = appkin
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
    event.preventDefault()
    electron.shell.openExternal(url).catch(console.error)
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
    if (!this.#unloading) this.#unloading = this._unloading()
    try {
      return await this.#unloading
    } finally {
      this.#unloading = null
    }
  }

  async _unloading () {
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
      if (this.options.hideOnClose) return
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

  #onactivate = () => {
    if (this.closing || this.closed) return
    this.show()
  }

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
      this.state = await this.appkin
      this.appkin = null
    }
    const session = electron.session.fromPartition(`persist:${this.sessname || (this.state.key ? hypercoreid.encode(this.state.key) : this.state.dir)}`)

    const { show = true } = { show: (options.show || options.window?.show) }
    const { height = this.constructor.height, width = this.constructor.width } = options
    this.win = new BrowserWindow({
      ...(options.window || options),
      height,
      width,
      frame: false,
      ...(isMac && this.state.options.platform?.__legacyTitlebar ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 12, y: 16 }, titleBarOverlay: true } : (isMac ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 0, y: 0 }, titleBarOverlay: true } : {})),
      ...(isMac && this.state?.alias === 'keet' && this.state?.appling?.path ? { icon: path.join(path.dirname(this.state.appling.path), 'resources', 'app', 'icon.ico') } : {}),
      show,
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload: require.main.filename,
        ...(decal === false ? { session } : {}),
        partition: 'persist:pear',
        additionalArguments: [JSON.stringify({ ...this.state.config, isDecal: true })],
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
    if (this.win.setWindowButtonVisibility) this.win.setWindowButtonVisibility(false) // configured by <pear-ctrl>
    this.hidden = !show

    this.win.on('focus', () => {
      if (this?.view?.webContents) this.view.webContents.focus()
    })

    this.win.on('close', (evt) => {
      if (this.options.hideOnClose && this.quitting === false) {
        evt.preventDefault()
        this.win.hide()
      } else {
        this.closing = true
      }
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

    electron.app.on('activate', this.#onactivate)

    if (this.id === null) this.id = idify(this)
    this.constructor[kMap].set(this.id, this)

    if (decal === false) {
      await this.win.loadURL(this.entry)
      this.opening = false
      this.closed = false
      return !this.closed
    }
    if (this.decalId === null) this.decalId = idify(this)
    this.constructor[kMap].set(this.decalId, this)
    this.closed = false
    this.win.setMenuBarVisibility(false)
    if (isMac === false) this.win.setAutoHideMenuBar(true)

    const decalUrl = `${this.sidecar}/decal.html`
    const decalLoading = this.win.loadURL(decalUrl)

    if (interload && (await interload(this)) === false) return false

    const toURL = (link) => {
      try {
        return new URL(link, this.state.config.applink)
      } catch (err) {
        console.error('Invalid link in Pear configuration links:', link)
        return null
      }
    }

    const allowedHosts = Array.from(new Set(Object.values(this?.state?.config?.options?.links || {})))
      .map((link) => toURL(link))
      .filter((link) => link !== null && (link.protocol === 'http:' || link.protocol === 'https:'))
    allowedHosts.push(new URL(this.entry))

    const onBeforeRequest = (details, respond) => {
      const url = new URL(details.url)
      const isAllowed = allowedHosts.some(({ protocol, hostname, port }) =>
        protocol === url.protocol && (hostname === '*' || hostname === url.hostname) && (port === '' || port === url.port))
      respond({ cancel: isAllowed === false })
    }
    const onBeforeSendHeaders = (details, next) => {
      details.requestHeaders.Pragma = details.requestHeaders['Cache-Control'] = 'no-cache'
      const sidecarURL = new URL(this.sidecar)
      const requestURL = new URL(details.url)
      if (requestURL.host === sidecarURL.host) {
        details.requestHeaders['User-Agent'] = `Pear ${this.state.id}`
      } else if (this.state?.config?.options?.userAgent) {
        details.requestHeaders['User-Agent'] = this.state.config.options.userAgent
      }
      next({ requestHeaders: details.requestHeaders })
    }

    const urls = ['http://*/*', 'https://*/*']
    session.webRequest.onBeforeRequest({ urls }, onBeforeRequest)
    session.webRequest.onBeforeSendHeaders(onBeforeSendHeaders)

    if (this.closing) return false

    this.view = new BrowserView({
      ...(options.view || options),
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload: require.main.filename,
        session,
        additionalArguments: [JSON.stringify({ ...this.state.config, parentWcId: this.win.webContents.id, decalled: true })],
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
    this.view.setBounds({ x: 0, y: 0, width, height })
    const viewLoading = this.view.webContents.loadURL(this.entry)
    viewInitialized()
    this.view.webContents.once('did-finish-load', () => { viewLoaded() })

    this.id = idify(this)
    this.constructor[kMap].set(this.id, this)

    await decalLoading
    if (this.closing) return false
    await viewLoading
    if (manualViewReveal === false) this.attachMainView()

    if (this.closing) return false

    if (typeof options.afterNativeViewLoaded === 'function') await options.afterNativeViewLoaded(this)

    if (this.closing) return false

    this.opening = false

    super.open()
    return !this.closed
  }

  async attachMainView () {
    await this.#viewInitialized
    this.win.setBrowserView(this.view)
    const { width, height } = this.win.getBounds()
    this.view.setBounds({ x: 0, y: 0, width, height })
    this.view.setAutoResize({
      width: true,
      height: true
    })
    this.win.on('resize', (e) => {
      e.preventDefault()
      const [width, height] = this.win.getSize()
      this.view.setBounds({ x: 0, y: 0, width, height })
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

  async setMinimizable (value) {
    const result = this.win.setMinimizable(value)
    return result
  }

  async setMaximizable (value) {
    const result = this.win.setMaximizable(value)
    return result
  }

  async setSize (width, height) {
    return this.win.setSize(width, height)
  }

  async fullscreen () {
    if (this.isFullscreen()) return true
    const fullscreen = once(this.win, 'enter-full-screen')
    const result = this.win.setFullScreen(true)
    await fullscreen
    const { width, height } = this.win.getBounds()
    const [view] = this.win.getBrowserViews()
    view.setBounds({ x: 0, y: 0, width, height })
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
    electron.app.off('activate', this.#onactivate)
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
      this.state = await this.appkin
      this.appkin = null
    }
    const session = electron.session.fromPartition(`persist:${this.sessname || (this.state.key ? hypercoreid.encode(this.state.key) : this.state.dir)}`)

    this.view = new BrowserView({
      ...(options?.view || options),
      backgroundColor: options.backgroundColor || DEF_BG,
      webPreferences: {
        preload: require.main.filename,
        session,
        additionalArguments: [JSON.stringify({ ...this.state.config, ...(options?.view?.config || options.config || {}), parentWcId: this.win.webContents.id })],
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
    const adjustedHeight = bounds.height - 0
    const { width = bounds.width, height = adjustedHeight } = options
    let { x = 0, y = 0 } = options
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

class PearGUI extends ReadyResource {
  static View = View
  static Window = Window
  constructor ({ socketPath, connectTimeout, tryboot, state }) {
    super()
    this.state = state
    this.ipc = new IPC.Client({
      lock: constants.PLATFORM_LOCK,
      socketPath,
      connectTimeout,
      api: {
        reports (method) {
          return (params) => {
            const stream = method.createRequestStream()
            stream.once('data', () => { PearGUI.reportMode(state) })
            stream.write(params)
            return stream
          }
        }
      },
      connect: tryboot
    })
    this.worker = new Worker()
    this.pipes = new Freelist()
    this.ipc.once('close', () => this.close())

    electron.ipcMain.on('exit', (e, code) => { process.exit(code) })

    electron.ipcMain.on('id', async (event) => {
      return (event.returnValue = event.sender.id)
    })

    electron.ipcMain.on('parentId', (event) => {
      const instance = this.get(event.sender.id)
      return (event.returnValue = instance.parentId)
    })

    electron.ipcMain.on('warming', (event) => {
      const warming = this.warming()
      warming.on('data', (data) => event.reply('warming', data))
      warming.on('end', () => {
        warming.end()
        event.reply('warming', null)
      })
    })

    electron.ipcMain.on('reports', (event) => {
      const reports = this.reports()
      reports.on('data', (data) => event.reply('reports', data))
      reports.on('end', () => {
        reports.end()
        event.reply('reports', null)
      })
    })

    electron.ipcMain.on('messages', (event, pattern) => {
      const messages = this.messages(pattern)
      messages.on('data', (data) => event.reply('messages', data))
      messages.on('end', () => {
        messages.end()
        event.reply('messages', null)
      })
    })

    electron.ipcMain.handle('getMediaAccessStatus', (evt, ...args) => this.getMediaAccessStatus(...args))
    electron.ipcMain.handle('askForMediaAccess', (evt, ...args) => this.askForMediaAccess(...args))
    electron.ipcMain.handle('desktopSources', (evt, ...args) => this.desktopSources(...args))
    electron.ipcMain.handle('chrome', (evt, ...args) => this.chrome(...args))
    electron.ipcMain.handle('ctrl', (evt, ...args) => this.ctrl(...args))
    electron.ipcMain.handle('parent', (evt, ...args) => this.parent(...args))
    electron.ipcMain.handle('open', (evt, ...args) => this.open(...args))
    electron.ipcMain.handle('close', (evt, ...args) => this.guiClose(...args))
    electron.ipcMain.handle('show', (evt, ...args) => this.show(...args))
    electron.ipcMain.handle('hide', (evt, ...args) => this.hide(...args))
    electron.ipcMain.handle('minimize', (evt, ...args) => this.minimize(...args))
    electron.ipcMain.handle('maximize', (evt, ...args) => this.maximize(...args))
    electron.ipcMain.handle('setMinimizable', (evt, ...args) => this.setMinimizable(...args))
    electron.ipcMain.handle('setMaximizable', (evt, ...args) => this.setMaximizable(...args))
    electron.ipcMain.handle('fullscreen ', (evt, ...args) => this.fullscreen(...args))
    electron.ipcMain.handle('restore', (evt, ...args) => this.restore(...args))
    electron.ipcMain.handle('focus', (evt, ...args) => this.focus(...args))
    electron.ipcMain.handle('blur', (evt, ...args) => this.blur(...args))
    electron.ipcMain.handle('dimensions', (evt, ...args) => this.dimensions(...args))
    electron.ipcMain.handle('isVisible', (evt, ...args) => this.isVisible(...args))
    electron.ipcMain.handle('isClosed', (evt, ...args) => this.isClosed(...args))
    electron.ipcMain.handle('isMinimized', (evt, ...args) => this.isMinimized(...args))
    electron.ipcMain.handle('isMaximized', (evt, ...args) => this.isMaximized(...args))
    electron.ipcMain.handle('isFullscreen', (evt, ...args) => this.isFullscreen(...args))
    electron.ipcMain.handle('setSize', (evt, ...args) => this.setSize(...args))
    electron.ipcMain.handle('permit', (evt, ...args) => this.permit(...args))
    electron.ipcMain.handle('unloading', async (evt, ...args) => this.unloading(...args))
    electron.ipcMain.handle('completeUnload', (evt, ...args) => this.completeUnload(...args))
    electron.ipcMain.handle('attachMainView', (evt, ...args) => this.attachMainView(...args))
    electron.ipcMain.handle('detachMainView', (evt, ...args) => this.detachMainView(...args))
    electron.ipcMain.handle('afterViewLoaded', (evt, ...args) => this.afterViewLoaded(...args))
    electron.ipcMain.handle('setWindowButtonPosition', (evt, ...args) => this.setWindowButtonPosition(...args))
    electron.ipcMain.handle('setWindowButtonVisibility', (evt, ...args) => this.setWindowButtonVisibility(...args))
    electron.ipcMain.handle('requestIdentity', (evt, ...args) => this.requestIdentity(...args))
    electron.ipcMain.handle('shareIdentity', (evt, ...args) => this.shareIdentity(...args))
    electron.ipcMain.handle('clearIdentity', (evt, ...args) => this.clearIdentity(...args))
    electron.ipcMain.handle('message', (evt, ...args) => this.message(...args))
    electron.ipcMain.handle('checkpoint', (evt, ...args) => this.checkpoint(...args))
    electron.ipcMain.handle('versions', (evt, ...args) => this.versions(...args))
    electron.ipcMain.handle('restart', (evt, ...args) => this.restart(...args))
    electron.ipcMain.handle('badge', (evt, ...args) => this.badge(...args))

    electron.ipcMain.on('workerRun', (evt, link, args) => {
      const pipe = this.worker.run(link, args)
      const id = this.pipes.alloc(pipe)
      pipe.on('close', () => {
        this.pipes.free(id)
        evt.reply('workerPipeClose')
      })
      pipe.on('data', (data) => { evt.reply('workerPipeData', data) })
      pipe.on('end', () => { evt.reply('workerPipeEnd') })
      pipe.on('error', (err) => { evt.reply('workerPipeError', err.stack) })
    })

    electron.ipcMain.on('workerPipeId', (evt) => {
      evt.returnValue = this.pipes.nextId()
      return evt.returnValue
    })

    electron.ipcMain.on('workerPipeEnd', (evt, id) => {
      const pipe = this.pipes.from(id)
      if (!pipe) return
      pipe.end()
    })

    electron.ipcMain.on('workerPipeClose', (evt, id) => {
      const pipe = this.pipes.from(id)
      if (!pipe) return
      pipe.destroy()
    })

    electron.ipcMain.on('workerPipeWrite', (evt, id, data) => {
      const pipe = this.pipes.from(id)
      if (!pipe) {
        console.error('Unexpected workerPipe error (unknown id)')
        return
      }
      pipe.write(data)
    })
  }

  async app () {
    const app = new App(this)
    this.once('close', async () => { app.quit() })
    await app.start()
    return app
  }

  async _open () {
    await this.ipc.ready()
  }

  async _close () {
    await this.ipc.close()
  }

  static async ctrl (type, entry, { state, parentId = 0, ua, sessname = null, appkin }, options = {}, openOptions = {}) {
    ;[entry] = entry.split('+')
    if (entry.slice(0, 2) === './') entry = entry.slice(1)
    if (entry[0] !== '/') entry = `/~${entry}`
    const info = { state, parentId, ua, sessname, appkin }
    const instance = type === 'view' ? new View(entry, options, info) : new Window(entry, options, info)
    if (typeof options.afterInstantiation === 'function') await options.afterInstantiation(instance)

    await instance.open(openOptions)

    return instance
  }

  static ctrls () { return Array.from(GuiCtrl[kMap].values()) }
  static fromWebContents (wc) {
    for (const [, ctrl] of GuiCtrl[kMap]) {
      if (ctrl.view?.webContents === wc || ctrl.win?.webContents === wc) return ctrl
    }
    return null
  }

  static ofSession (session) {
    return Array.from(GuiCtrl[kMap].values()).filter((ctrl) => ctrl.session === session)
  }

  static ofContext (state) {
    return Array.from(GuiCtrl[kMap].values()).filter((ctrl) => ctrl.state === state)
  }

  static reportMode (state) {
    const ctrls = this.ofContext(state)
    for (const ctrl of ctrls) if (ctrl.detachMainView) ctrl.detachMainView()
  }

  static chrome (name) {
    const win = new electron.BrowserWindow({ show: true })
    win.loadURL('chrome://' + name)
  }

  has (id) { return GuiCtrl[kMap].has(id) }

  get (id) {
    const instance = GuiCtrl[kMap].get(id)
    if (!instance) {
      return {
        ghost: true,
        guiClose () { return false },
        show () { return false },
        hide () { return false },
        focus () { return false },
        blur () { return false },
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
  }

  getMediaAccessStatus ({ media }) {
    if (isLinux) {
      return 'unsupported'
    } else {
      return electron.systemPreferences.getMediaAccessStatus(media)
    }
  }

  async askForMediaAccess ({ id, media }) {
    if (isLinux || isWindows) return false
    if (media === 'screen') {
      return electron.systemPreferences.getMediaAccessStatus(media)
    }

    return electron.systemPreferences.askForMediaAccess(media)
  }

  desktopSources (params) {
    return electron.desktopCapturer.getSources(params)
  }

  chrome ({ name }) { return this.constructor.chrome(name) }

  async ctrl (params) {
    const { parentId, type, entry, options = {}, openOptions, state } = params
    const instance = await this.constructor.ctrl(type, entry, { parentId, state }, options, openOptions)
    return instance.id
  }

  async parent ({ id, act, args }) {
    const instance = this.get(id)
    if (!instance) throw new Error(`Could not find parent with id "${id}" to perform action "${act}"!`)
    if (act === 'focus') return instance.focus(...args)
    if (act === 'blur') return instance.blur()
    if (act === 'show') return instance.show()
    if (act === 'hide') return instance.hide()
    if (act === 'dimensions') return instance.dimensions(...args)
    if (act === 'isClosed') return instance.isClosed()
    if (act === 'isVisible') return instance.isVisible()
    if (act === 'isMinimized') return instance.isMinimized()
    if (act === 'isMaximized') return instance.isMaximized()
    if (act === 'isFullscreen') return instance.isFullscreen()
  }

  open ({ id, options }) { return this.get(id).open(options) }

  // guiClose because ReadyResource needs close (affects internal naming only)
  guiClose ({ id }) { return this.get(id).close() }

  show ({ id }) { return this.get(id).show() }

  hide ({ id }) { return this.get(id).hide() }

  minimize ({ id }) { return this.get(id).minimize() }

  maximize ({ id }) { return this.get(id).maximize() }

  setMinimizable ({ id, value }) { return this.get(id).setMinimizable(value) }

  setMaximizable ({ id, value }) { return this.get(id).setMaximizable(value) }

  fullscreen ({ id }) { return this.get(id).fullscreen() }

  restore ({ id }) { return this.get(id).restore() }

  focus ({ id, options }) { return this.get(id).focus(options) }

  blur ({ id }) { return this.get(id).blur() }

  dimensions ({ id, options }) { return this.get(id).dimensions(options) }

  isVisible ({ id }) { return this.get(id).isVisible() }

  isClosed ({ id }) { return (this.has(id)) ? this.get(id).isClosed() : true }

  isMinimized ({ id }) { return this.get(id).isMinimized() }

  isMaximized ({ id }) { return this.get(id).isMaximized() }

  isFullscreen ({ id }) { return this.get(id).isFullscreen() }

  setSize ({ id, width, height }) { return this.get(id).setSize(width, height) }

  unloading ({ id }) { return this.get(id).unloading() }

  async completeUnload ({ id, action }) {
    const instance = this.get(id)
    if (!instance) return
    instance.completeUnload(action)
  }

  async attachMainView ({ id }) { this.get(id).attachMainView() }

  async detachMainView ({ id }) { this.get(id).detachMainView() }

  async afterViewLoaded ({ id }) {
    return this.get(id).afterViewLoaded()
  }

  async setWindowButtonPosition ({ id, point }) {
    const instance = this.get(id)
    if (!instance) return
    instance.setWindowButtonPosition(point)
  }

  async setWindowButtonVisibility ({ id, visible }) {
    const instance = this.get(id)
    if (!instance) return
    instance.setWindowButtonVisibility(visible)
  }

  requestIdentity (params) { return this.ipc.requestIdentity(params) }

  shareIdentity (identity) { return this.ipc.shareIdentity(identity) }

  clearIdentity () { return this.ipc.clearIdentity() }

  message (msg) { return this.ipc.message(msg) }

  messages (pattern) { return this.ipc.messages(pattern) }

  checkpoint (state) { return this.ipc.checkpoint(state) }

  versions () { return this.ipc.versions() }

  restart (opts = {}) { return this.ipc.restart(opts) }

  warming () { return this.ipc.warming() }

  reports () { return this.ipc.reports() }

  permit (params) { return this.ipc.permit(params) }

  badge (count) { return electron.app.setBadgeCount(count) }
}

class Freelist {
  alloced = []
  freed = []

  nextId () {
    return this.freed.length === 0 ? this.alloced.length : this.freed[this.freed.length - 1]
  }

  alloc (item) {
    const id = this.freed.length === 0 ? this.alloced.push(null) - 1 : this.freed.pop()
    this.alloced[id] = item
    return id
  }

  free (id) {
    this.freed.push(id)
    this.alloced[id] = null
  }

  from (id) {
    return id < this.alloced.length ? this.alloced[id] : null
  }

  emptied () {
    return this.freed.length === this.alloced.length
  }

  * [Symbol.iterator] () {
    for (const item of this.alloced) {
      if (item === null) continue
      yield item
    }
  }
}

function parseConfigNumber (value, field) {
  if (value === undefined || typeof value === 'number') return value
  if (typeof value === 'string' && Number.isFinite(+value)) return +value
  throw new Error(`The value of ${field} configuration field must be a number or numeric string, got: ${value}`)
}

module.exports = PearGUI
