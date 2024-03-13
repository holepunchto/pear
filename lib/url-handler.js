'use strict'

const { isWindows, isLinux } = require('which-runtime')

module.exports = function register (executable) {
  if (isLinux) registerLinuxHandler(executable)
  if (isWindows) registerWindowsHandler(executable)
}

function registerLinuxHandler (executable) {
  if (!executable) return

  const fs = require('bare-fs')
  const os = require('bare-os')
  const { join } = require('bare-path')
  const { spawnSync } = require('bare-subprocess')

  if (!checkXdgMime()) return

  const APP_NAME = 'Pear'
  const ICON_NAME = 'pear'
  const DESKTOP_FILE_NAME = 'pear.desktop'
  const APPLICATIONS_DIR = join(os.homedir(), '.local', 'share', 'applications')
  const DESKTOP_FILE_PATH = join(APPLICATIONS_DIR, DESKTOP_FILE_NAME)
  const MIME_TYPES = ['x-scheme-handler/pear']

  try {
    if (!checkExists(APPLICATIONS_DIR)) {
      fs.mkdirSync(APPLICATIONS_DIR, { recursive: true })
    }

    if (!checkDesktopFile(executable)) {
      fs.writeFileSync(DESKTOP_FILE_PATH, generateDesktopFile(executable), { encoding: 'utf-8' })
    }
    for (const mimeType of MIME_TYPES) {
      if (!checkMimeType(mimeType)) {
        registerMimeType(mimeType)
      }
    }
  } catch (err) {
    console.error('could not install protocol handler:', err)
  }

  function checkXdgMime () {
    try {
      spawnSync('xdg-mime', ['--version'])
      return true
    } catch (err) {
      return false
    }
  }

  function checkExists (path) {
    try {
      fs.accessSync(path)
      return true
    } catch (err) {
      return false
    }
  }

  function checkDesktopFile () {
    try {
      return fs.readFileSync(DESKTOP_FILE_PATH, 'utf-8').includes(`Exec=${executable} run %U`)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      return false
    }
  }

  function checkMimeType (mimeType) {
    try {
      return spawnSync('xdg-mime', ['query', 'default', mimeType]).stdout.toString() === DESKTOP_FILE_NAME
    } catch {
      return false
    }
  }

  function registerMimeType (mimeType) {
    try {
      spawnSync('xdg-mime', ['default', DESKTOP_FILE_NAME, mimeType])
      return true
    } catch {
      return false
    }
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
MimeType=${MIME_TYPES.join(';')};
NoDisplay=true
`
  }
}

function registerWindowsHandler (executable) {
  if (!executable) return

  const { spawnSync } = require('bare-subprocess')

  const PROTOCOL = 'pear'
  const HANDLER_NAME = 'Pear Application'
  const HANDLER_COMMAND = `"${executable}" "%1"`

  const REGISTRY_PATH = `HKCU\\Software\\Classes\\${PROTOCOL}`
  const REGISTRY_COMMAND_PATH = `${REGISTRY_PATH}\\shell\\open\\command`

  try {
    if (spawnSync('reg', ['query', REGISTRY_PATH, '/v', 'URL Protocol']).status !== 0) {
      spawnSync('reg', ['add', REGISTRY_PATH, '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'])
      spawnSync('reg', ['add', REGISTRY_PATH, '/v', '', '/t', 'REG_SZ', '/d', HANDLER_NAME, '/f'])
    }

    const currentHandler = spawnSync('reg', ['query', REGISTRY_COMMAND_PATH])
      .stdout.toString()?.match(/REG_SZ\s+"([^"]+)"/)?.[1]

    if (currentHandler !== executable) {
      spawnSync('reg', ['add', REGISTRY_COMMAND_PATH, '/v', '', '/t', 'REG_SZ', '/d', HANDLER_COMMAND, '/f'])
    }
  } catch (err) {
    console.error('could not install protocol handler:', err)
  }
}
