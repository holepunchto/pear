'use strict'
const os = require('bare-os')
const path = require('bare-path')
const which = require('bare-which')
const install = require('pear-install/cmd').runner
const { localPkg } = require('../lib/package')
const { PEAR_MAKE_LINK } = require('../constants.js')
const { ERR_INVALID_INPUT, ERR_INVALID_PROJECT_DIR } = require('pear-errors')
const context = require('../context')
const { outputter, stdio } = require('../lib/terminal.js')

const output = outputter('make', {
  make: ({ chunk }) => chunk,
  error: ({ code, message, stack }) => `Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function make(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  const host = cmd.flags.host
  const noInstall = !cmd.flags.install
  const name = cmd.flags.name

  const cwd = os.cwd()
  const pkg = await localPkg(cwd)
  if (!pkg) {
    throw ERR_INVALID_PROJECT_DIR(`package.json not found in ${cwd}.`)
  }
  if (!pkg.bin) {
    throw ERR_INVALID_INPUT(`bin field not found in package.json`)
  }
  const entrypoint = path.resolve(cwd, pkg.bin)
  const pathDir = path.resolve(cwd, cmd.flags.path || '.')

  if (!noInstall) {
    const pearMakeCLI = os.platform === 'win32' ? 'pear-make.exe' : 'pear-make'
    const found = await which(pearMakeCLI, { nothrow: true })

    if (!found) {
      const installCmd = {
        flags: {
          json: cmd.json
        },
        args: {
          link: PEAR_MAKE_LINK
        }
      }

      await install(installCmd)
    }
  }

  const stream = ipc.make({ entrypoint, host, pathDir, name })
  await output(
    {
      json,
      log: (line) => stdio.out.write(`${line}`)
    },
    stream
  )
}
