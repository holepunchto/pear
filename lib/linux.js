'use strict'
const fs = require('fs')
const os = require('os')
const { join } = require('path')
const { execSync } = require('child_process')

const APP_NAME = 'Keet'
const ICON_NAME = 'keet'
const DESKTOP_FILE_NAME = 'keet.desktop'
const DESKTOP_FILE_PATH = join(os.homedir(), '.local', 'share', 'applications', DESKTOP_FILE_NAME)
const MIME_TYPES = [
  'x-scheme-handler/holepunch', // legacy
  'x-scheme-handler/punch', // legacy
  'x-scheme-handler/pear' // pear
]

module.exports = function linux (executable) {
  if (!executable) return
  try {
    if (!checkDesktopFile(executable)) {
      fs.writeFileSync(DESKTOP_FILE_PATH, generateDesktopFile(executable), { encoding: 'utf-8' })
    }
    for (const mimeType of MIME_TYPES) {
      if (!checkMimeType(mimeType)) {
        registerMimeType(mimeType)
      }
    }
  } catch (err) {
    console.warn('could not install protocol handler:', err)
  }
}

function checkDesktopFile () {
  try {
    fs.statSync(DESKTOP_FILE_PATH)
    return true
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return false
  }
}

function checkMimeType (mimeType) {
  return execSync(`xdg-mime query default ${mimeType}`) === DESKTOP_FILE_NAME
}

function registerMimeType (mimeType) {
  return execSync(`xdg-mime default ${DESKTOP_FILE_NAME} ${mimeType}`)
}

function generateDesktopFile (executable) {
  return `\
[Desktop Entry]
Name=${APP_NAME}
Exec=${executable} %U
Terminal=false
Icon=${ICON_NAME}
Type=Application
StartupWMClass=${APP_NAME}
X-AppImage-Version=1.0.1
Comment=${APP_NAME}
MimeType=${MIME_TYPES.join(';')}
`
}
