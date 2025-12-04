const Thread = require('bare-thread')
const { App, Screen, Window, WebView } = require('fx-native')
const appling = require('appling-native')
const { encode, decode } = require('./utils')
const { preflight } = require('./preflight')
const html = require('./view.html')

const WINDOW_HEIGHT = 548
const WINDOW_WIDTH = 500

async function install(id, opts = {}) {
  const { platform = 'pzcjqmpoo6szkoc4bpkw65ib9ctnrq7b6mneeinbhbheihaq6p6o' } = opts

  using lock = await preflight(id)

  const config = {
    dir: lock.dir,
    platform,
    link: `pear://${id}`
  }

  const app = App.shared()

  let window
  let view

  function onViewMessage(message) {
    const msg = message.toString()
    switch (msg) {
      case 'quit':
        window.close()
        break
      case 'install':
        app.broadcast(encode({ type: 'install' }))
        break
      case 'launch': {
        lock.unlock()
        const app = new appling.App(id)
        app.open()
        window.close()
        break
      }
    }
  }

  function onWorkerMessage(message) {
    const msg = decode(message)
    switch (msg.type) {
      case 'ready':
        app.broadcast(encode({ type: 'config', data: config }))
        break
      case 'download':
        view.postMessage({ type: 'progress', data: msg.data })
        break
      case 'complete':
        view.postMessage({ type: 'state', state: 'complete' })
        break
      case 'error':
        view.postMessage({ type: 'state', state: 'error' })
        break
    }
  }

  app
    .on('launch', () => {
      new Thread(require.resolve('./worker'))

      const { width, height } = Screen.main().getBounds()

      window = new Window(
        (width - WINDOW_WIDTH) / 2,
        (height - WINDOW_HEIGHT) / 2,
        WINDOW_WIDTH,
        WINDOW_HEIGHT,
        { frame: false }
      )

      view = new WebView(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT)
      view.on('message', onViewMessage).loadHTML(html)

      window.appendChild(view)
      window.show()
    })
    .on('terminate', () => {
      window.destroy()
    })
    .on('message', onWorkerMessage)
    .run()
}

module.exports = { install }
