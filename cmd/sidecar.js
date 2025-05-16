'use strict'
const path = require('bare-path')
const teardown = require('pear-api/teardown')
const { isWindows } = require('which-runtime')
const { print, ansi, stdio, isTTY } = require('pear-api/terminal')
module.exports = (ipc) => async function sidecar (cmd) {
  if (!isWindows && isTTY) teardown(() => { stdio.out.write('\x1B[1K\x1B[G') })
  print('Closing any current Sidecar clients...', 0)
  const restarts = await ipc.closeClients()
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await ipc.shutdown()
  print('Sidecar has shutdown', true)
  if (cmd.command.name === 'shutdown') return
  const { CHECKOUT, RUNTIME } = require('pear-api/constants')
  const KEY = CHECKOUT.key

  print('Rebooting current process as Sidecar\n  - [ ' + KEY + ' ]', 0)
  print(ansi.gray('Runtime: ' + path.basename(RUNTIME)), 0)
  if (cmd.flags.mem) print(ansi.green('Memory Mode On') + ansi.gray(' [ --mem ]'), 0)
  print('\n========================= INIT ===================================\n')

  Bare.argv.splice(Bare.argv.indexOf('sidecar'), 1)
  Bare.argv.splice(1, 0, '--sidecar', '--log')

  require('../sidecar')

  print('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  print('Current process is now Sidecar', true)
  print(ansi.gray('Version: ' + JSON.stringify(CHECKOUT, 0, 4).slice(0, -1) + '  }'), 0)
  const commands = restarts.filter(({ id = null }) => id !== null)
  if (commands.length > 0) {
    print('Restart Commands:', 0)
    for (const { dir, cmdArgs = [] } of commands) {
      const runix = cmdArgs.indexOf('--run')
      const devix = cmdArgs.indexOf('--dev')
      if (runix > -1) {
        const key = cmdArgs[runix + 1]
        cmdArgs.splice(runix, 2)
        cmdArgs.unshift('run', key)
      } else if (devix > -1) {
        cmdArgs[devix] = 'dev'
        if (cmdArgs[devix + 1][0] !== '/' && cmdArgs[devix + 1][0] !== '.') {
          cmdArgs.splice(devix + 1, 0, dir)
        }
        const insix = cmdArgs.indexOf('--inspector-port')
        cmdArgs.splice(insix, 2)
      }
      const swapix = cmdArgs.indexOf('--swap')
      if (swapix > -1) cmdArgs.splice(swapix, 2)
      stdio.out.write('  ')
      if (cmdArgs[0] === 'seed' && cmdArgs.some(([ch]) => ch === '/' || ch === '.') === false) cmdArgs[cmdArgs.length] = dir
      print(ansi.gray('pear ' + cmdArgs.join(' ')), 0)
    }
  }

  print('\n========================= RUN ====================================\n')
}
