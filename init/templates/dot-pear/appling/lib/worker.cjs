const { App } = require('fx-native')
const bootstrap = require('pear-updater-bootstrap')
const appling = require('appling-native')
const { encode, decode, format } = require('./utils')
const { Progress } = require('./progress')

const app = App.shared()

let config
let platform

function setup(data) {
  config = data
}

async function install() {
  const progress = new Progress(app, [0.3, 0.7])
  let platformFound = false
  let bootstrapInterval = null

  try {
    try {
      platform = await appling.resolve(config.dir)
      platformFound = true
    } catch (e) {
      await bootstrap(config.platform, config.dir, {
        lock: false,
        onupdater: (u) => {
          bootstrapInterval = setInterval(() => {
            progress.update(format(u))
            if (u.downloadProgress === 1) {
              clearInterval(bootstrapInterval)
            }
          }, 250)
        }
      })
      platform = await appling.resolve(config.dir)
    }
    if (platformFound) {
      progress.stage(0, 1)
    }
    progress.update({ progress: 0, speed: '', peers: 0, bytes: 0 }, 1)
    await platform.preflight(config.link, (u) => {
      progress.update(format(u), 1) // stage = 1
    })
    progress.complete()
    app.broadcast(encode({ type: 'complete' }))
  } catch (e) {
    console.error('Bootstrap error: %o', e)
    app.broadcast(encode({ type: 'error', error: e.message }))
  } finally {
    clearInterval(bootstrapInterval)
  }
}

app.on('message', async (message) => {
  const msg = decode(message)
  switch (msg.type) {
    case 'config':
      setup(msg.data)
      break
    case 'install':
      await install()
      break
  }
})

app.broadcast(encode({ type: 'ready' }))
