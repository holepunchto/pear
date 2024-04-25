#!/usr/bin/env node
const Hypercore = require('hypercore')
const HypercoreID = require('hypercore-id-encoding')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { isWindows, isLinux, isMac, platform, arch } = require('which-runtime')

const PEAR_KEY = 'pqbzjhqyonxprx8hghxexnmctw75mr91ewqw5dxe1zmntfyaddqy'
const DKEY = Hypercore.discoveryKey(HypercoreID.decode(PEAR_KEY)).toString('hex')

const HOST = platform + '-' + arch

const PEAR_DIR = isMac
  ? path.join(os.homedir(), 'Library', 'Application Support', 'pear')
  : isLinux
    ? path.join(os.homedir(), '.config', 'pear')
    : path.join(os.homedir(), 'AppData', 'Roaming', 'pear')

const LINK = path.join(PEAR_DIR, 'current')
const BIN = path.join(PEAR_DIR, 'bin')
const CURRENT_BIN = path.join(LINK, 'by-arch', HOST, 'bin/pear-runtime' + (isWindows ? '.exe' : ''))

if (isInstalled()) {
  require('child_process').spawn(CURRENT_BIN, process.argv.slice(2), {
    stdio: 'inherit'
  }).on('exit', function (code) {
    process.exit(code)
  })
} else {
  const bootstrap = require('pear-updater-bootstrap')

  console.log('Installing Pear Runtime (Please stand by, this might take a bit...)')
  bootstrap(PEAR_KEY, PEAR_DIR).then(function () {
    console.log('Pear Runtime installed!')
    console.log()
    console.log('Finish the installation by opening the runtime app')
    console.log()
    console.log('pear run pear://runtime')
    if (makeBin()) {
      console.log()
      console.log('Or by adding the following to your path')
      console.log()
      console.log('export PATH="' + BIN + ':$PATH"')
    }
  })
}

function makeBin () {
  try {
    fs.mkdirSync(BIN, { recursive: true })

    if (isWindows) {
      fs.writeFileSync(path.join(BIN, 'pear.cmd'), `@echo off\r\n"${CURRENT_BIN}" %*`)
      fs.writeFileSync(path.join(BIN, 'pear.ps1'), `& "${CURRENT_BIN}" @args`)
    } else {
      fs.symlinkSync(CURRENT_BIN, path.join(BIN, 'pear'))
    }
  } catch {
    return false
  }
  return true
}

function isInstalled () {
  try {
    const p = fs.realpathSync(LINK)
    return path.basename(path.dirname(p)) === DKEY
  } catch {
    return false
  }
}
