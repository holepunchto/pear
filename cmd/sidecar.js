'use strict'
const path = require('bare-path')
const { print, ansi, stdio } = require('./iface')
const parse = require('../lib/parse')

module.exports = (rpc) => async function sidecar (args) {
  print('Closing any current Sidecar clients...', 0)
  const restarts = await rpc.closeClients()
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await rpc.shutdown()

  print('Sidecar has shutdown', true)

  const { CHECKOUT, RUNTIME } = require('../lib/constants')
  const KEY = parse.arg('--boot-key', args) || CHECKOUT.key

  if (KEY !== CHECKOUT.key) {
    Bare.argv.unshift('--boot-key', KEY)
    delete require.cache[require.resolve('../lib/constants')] // refresh constants for new boot-key
  }
  print('Rebooting current process as Sidecar\n  - [ ' + KEY + ' ]', 0)
  print(ansi.gray('Runtime: ' + path.basename(RUNTIME)), 0)
  if (Bare.argv.includes('--mem')) print(ansi.green('Memory Mode On') + ansi.gray(' [ --mem ]'), 0)
  print('\n========================= INIT ===================================\n')

  Bare.argv.push('--spindown-timeout=2147483647', ...args)
  Bare.argv.push('--runtime', RUNTIME)
  if (!Bare.argv.includes('--verbose')) Bare.argv.push('--verbose')

  require('../sidecar')

  print('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  print('Current process is now Sidecar', true)
  print(ansi.gray('Version: ' + JSON.stringify(CHECKOUT, 0, 4).slice(0, -1) + '  }'), 0)
  if (restarts.length > 0) {
    print('Restart Commands:', 0)
    for (const { id = null, cwd, argv, clientArgv = [] } of restarts) {
      if (id !== null) continue
      const cmd = clientArgv.length ? clientArgv.slice(2) : argv
      if (cmd === argv) {
        let runix = cmd.indexOf('--run')
        if (runix === -1) runix = cmd.indexOf('--launch') // legacy alias
        const devix = cmd.indexOf('--dev')
        if (runix > -1) {
          const key = cmd[runix + 1]
          cmd.splice(runix, 2)
          cmd.unshift('run', key)
        } else if (devix > -1) {
          cmd[devix] = 'dev'
          if (cmd[devix + 1][0] !== '/' && cmd[devix + 1][0] !== '.') {
            cmd.splice(devix + 1, 0, cwd)
          }
          const insix = cmd.indexOf('--inspector-port')
          cmd.splice(insix, 2)
        }
      }
      const swapix = cmd.indexOf('--swap')
      if (swapix > -1) cmd.splice(swapix, 2)
      stdio.out.write('  ')
      if (cmd[0] === 'seed' && cmd.some(([ch]) => ch === '/' || ch === '.') === false) cmd[cmd.length] = cwd
      print(ansi.gray('pear ' + cmd.join(' ')), 0)
    }
  }

  print('\n========================= RUN ====================================\n')
}
