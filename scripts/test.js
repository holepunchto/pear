'use strict'
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { isWindows } = require('which-runtime')
const { RUNTIME } = require('../constants')
const { pathname } = new URL(global.Pear.config.applink)
const cwd = isWindows ? path.normalize(pathname.slice(1)) : pathname

const tests = spawn(RUNTIME, ['run', '-t', 'test', ...global.Pear.config.args], { cwd, stdio: 'inherit' })

tests.on('exit', (code) => {
  Bare.exitCode = code
})