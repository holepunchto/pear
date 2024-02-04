const { PRELOAD } = require('./lib/constants')

const { app, BrowserWindow } = require('electron')
const http = require('http')

app.whenReady().then(function () {
  const win = new BrowserWindow({
    webPreferences: {
      preload: PRELOAD
    }
  })

  win.loadURL('http://localhost:9999/')
})

http.createServer(function (req, res) {
  res.end('hello world!')
}).listen(9999)
