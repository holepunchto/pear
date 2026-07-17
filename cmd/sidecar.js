'use strict'
const context = require('../context')
const path = require('bare-path')
const gracedown = require('pear-gracedown')
const { isWindows } = require('which-runtime')
const { print, ansi, stdio, isTTY } = require('../lib/terminal.js')
const Logger = require('../lib/logger.js')
const constants = require('../constants.js')
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

  print('Rebooting current process as Sidecar', 0)
  print('Runtime: ' + path.basename(constants.RUNTIME), 0)
  print('\n========================= INIT ===================================\n')

  const { logLevel, logLabels, logMax } = cmd.flags
  LOG.labels.add('sidecar')
  if (logLabels) {
    for (const label of logLabels.split(',')) {
      if (label.trim()) LOG.labels.add(label.trim())
    }
  }
  if (logMax) LOG.all = true
  if (logLevel !== undefined) LOG.setLevel(logLevel)
  else if (logMax) LOG.setLevel('trace')
  else if (Logger.levels[LOG.level] < Logger.levels.info) LOG.setLevel('info')

  constants.SPINDOWN_TIMEOUT = Number.MAX_SAFE_INTEGER // keep-alive
  require('../sidecar')

  print('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  print('Current process is now Sidecar', true)
  print(ansi.gray(JSON.stringify({ version, key }, 0, 4)))
  if (restarts.length > 0) {
    print('Restart Commands:', 0)
    for (const { cmdArgs = [] } of restarts) {
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
