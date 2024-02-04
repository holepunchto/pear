const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

app.whenReady().then(function () {
  const win = new BrowserWindow({
    webPreferences: {
      preload: require.main.filename,
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

  win.loadURL('http://localhost:9999/')
})

http.createServer(function (req, res) {
  res.end('hello world!')
}).listen(9999)
