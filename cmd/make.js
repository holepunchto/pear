'use strict'
const os = require('bare-os')
const path = require('bare-path')
const which = require('bare-which')
const install = require('pear-install/cmd').runner
const { localPkg } = require('../lib/package')
const { PEAR_MAKE_LINK } = require('../constants.js')
const { ERR_INVALID_INPUT, ERR_INVALID_PROJECT_DIR, ERR_NOT_FOUND } = require('pear-errors')
const context = require('../context')
const { outputter, stdio, confirm, ansi, isTTY } = require('../lib/terminal.js')

const output = outputter('make', {
  make: ({ chunk }) => chunk,
  error: ({ code, message, stack }) => `Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function make(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  const version = cmd.flags.version
  const host = cmd.flags.host
  const name = cmd.flags.name
  const noInstall = !cmd.flags.install
  const installConfirmed = cmd.flags.install && cmd.indices.flags.install !== undefined

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

    if (installConfirmed || !found) {
      if (!installConfirmed) {
        if (json || isTTY === false) {
          throw ERR_NOT_FOUND(
            `The pear-make CLI was not found. Please install using: pear install ${PEAR_MAKE_LINK}`
          )
        }

        const dialog =
          ansi.warning + `The pear-make CLI needs to be installed. To confirm type "INSTALL"\n`
        const ask = `Install pear-make`
        const delim = '?'
        const validation = (value) => value === 'INSTALL'
        const msg = '\n' + ansi.cross + ' uppercase INSTALL to confirm\n'
        await confirm(dialog, ask, delim, validation, msg)
      }

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

  const stream = ipc.make({ entrypoint, host, pathDir, name, version })
  await output(
    {
      json,
      log: (line) => stdio.out.write(`${line}`)
    },
    stream
  )
}
