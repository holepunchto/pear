'use strict'
const path = require('bare-path')
const gracedown = require('pear-gracedown')
const { isWindows } = require('which-runtime')
const { print, ansi, stdio, isTTY } = require('pear-terminal')
const Logger = require('pear-logger')
module.exports = async function sidecar(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  if (cmd.command.name === 'inspect') {
    const inspectorKey = await ipc.inspect()
    print(`\n${ansi.bold('Sidecar inspector enabled.')}\n`)
    print(
      `${ansi.yellow(ansi.bold('Security Warning:'))} Do not share this inspector key unless you trust the recipient and understand the risks.`
    )
    print(`${ansi.bold('Inspector Key:')} ${inspectorKey.toString('hex')}\n`)
    return
  }
  if (!isWindows && isTTY)
    gracedown(() => {
      stdio.out.write('\x1B[1K\x1B[G')
    })
  print('Closing any current Sidecar clients...', 0)
  const restarts = await ipc.closeClients()
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await ipc.shutdown()
  print('Sidecar has shutdown', true)
  if (cmd.command.name === 'shutdown') return
  const { CHECKOUT, RUNTIME } = require('pear-constants')
  const KEY = CHECKOUT.key

  print('Rebooting current process as Sidecar\n  - [ ' + KEY + ' ]', 0)
  print(ansi.gray('Runtime: ' + path.basename(RUNTIME)), 0)
  if (cmd.flags.mem)
    print(ansi.green('Memory Mode On') + ansi.gray(' [ --mem ]'), 0)
  print(
    '\n========================= INIT ===================================\n'
  )

  Bare.argv.splice(Bare.argv.lastIndexOf('sidecar'), 1)
  Bare.argv.splice(1, 0, '--sidecar')

  Logger.switches.labels +=
    (Logger.switches.labels.length > 0 ? ',' : '') + 'sidecar'
  if (Logger.switches.level < 2) {
    Logger.switches.level = 2
    global.LOG = new Logger({ pretty: true })
  }

  Pear.constructor.CONSTANTS.SPINDOWN_TIMEOUT = Number.MAX_SAFE_INTEGER // keep-alive
  require('../sidecar')

  print(
    '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n'
  )
  print('Current process is now Sidecar', true)
  print(
    ansi.gray(
      'Version: ' + JSON.stringify(CHECKOUT, 0, 4).slice(0, -1) + '  }'
    ),
    0
  )
  const commands = restarts.filter(({ id = null }) => id !== null)
  if (commands.length > 0) {
    print('Restart Commands:', 0)
    for (const { dir, cmdArgs = [] } of commands) {
      const devix = cmdArgs.indexOf('--dev')
      if (devix > -1) {
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
      if (
        cmdArgs[0] === 'seed' &&
        cmdArgs.some(([ch]) => ch === '/' || ch === '.') === false
      )
        cmdArgs[cmdArgs.length] = dir
      print(ansi.gray('pear ' + cmdArgs.join(' ')), 0)
    }
  }

  print(
    '\n========================= RUN ====================================\n'
  )
}
