'use strict'
const context = require('../context')
const path = require('bare-path')
const gracedown = require('pear-gracedown')
const { isWindows } = require('which-runtime')
const { print, ansi, stdio, isTTY } = require('pear-terminal')
const Logger = require('pear-logger')
const constants = require('pear-constants')
const { upgrade: key, version } = require('../package.json')
module.exports = async function sidecar(cmd) {
  const ipc = context.getIPC()
  if (cmd.command.name === 'inspect') {
    const inspectorKey = await ipc.inspect()
    print(`\n${ansi.bold('Sidecar inspector enabled.')}\n`)
    print(
      `${ansi.yellow(ansi.bold('Security Warning:'))} Do not share this inspector key unless you trust the recipient and understand the risks.`
    )
    print(`${ansi.bold('Inspector Key:')} ${inspectorKey.toString('hex')}\n`)
    return
  }
  if (!isWindows && isTTY) {
    gracedown(() => {
      stdio.out.write('\x1B[1K\x1B[G')
    })
  }
  print('Closing any current Sidecar clients...', 0)
  const restarts = await withTimeout(ipc.closeClients(), 8000, [])
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await withTimeout(ipc.shutdown(), 8000)
  print('Sidecar has shutdown', true)
  if (cmd.command.name === 'shutdown') return

  print('Rebooting current process as Sidecar\n  - [ ' + key + ' ]', 0)
  print(ansi.gray('Runtime: ' + path.basename(constants.RUNTIME)), 0)
  if (cmd.flags.mem) print(ansi.green('Memory Mode On') + ansi.gray(' [ --mem ]'), 0)
  print('\n========================= INIT ===================================\n')

  Bare.argv.splice(Bare.argv.lastIndexOf('sidecar'), 1)
  Bare.argv.splice(1, 0, '--sidecar')

  Logger.switches.labels += (Logger.switches.labels.length > 0 ? ',' : '') + 'sidecar'
  if (Logger.switches.level < 2) {
    Logger.switches.level = 2
    global.LOG = new Logger({ pretty: true })
  }

  constants.SPINDOWN_TIMEOUT = Number.MAX_SAFE_INTEGER // keep-alive
  require('../sidecar')

  print('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  print('Current process is now Sidecar', true)
  print(ansi.gray('Version: ' + JSON.stringify({ key, version }, 0, 4).slice(0, -1) + '  }'), 0)
  const commands = restarts.filter(({ id = null }) => id !== null)
  if (commands.length > 0) {
    print('Restart Commands:', 0)
    for (const { cmdArgs = [] } of commands) {
      stdio.out.write('  ')
      print(ansi.gray('pear ' + cmdArgs.join(' ')), 0)
    }
  }

  print('\n========================= RUN ====================================\n')
}

async function withTimeout(promise, ms, fallback = undefined) {
  let timer = null
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      })
    ])
  } catch {
    return fallback
  } finally {
    if (timer) clearTimeout(timer)
  }
}
