'use strict'
const path = require('bare-path')
const { print, ansi, stdio } = require('./iface')

module.exports = (ipc) => async function sidecar (cmd) {
  print('Closing any current Sidecar clients...', 0)
  const restarts = await ipc.closeClients()
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await ipc.shutdown()

  print('Sidecar has shutdown', true)

  const { CHECKOUT, RUNTIME } = require('../constants')
  const KEY = CHECKOUT.key

  print('Rebooting current process as Sidecar\n  - [ ' + KEY + ' ]', 0)
  print(ansi.gray('Runtime: ' + path.basename(RUNTIME)), 0)
  if (cmd.flags.mem) print(ansi.green('Memory Mode On') + ansi.gray(' [ --mem ]'), 0)
  print('\n========================= INIT ===================================\n')

  Bare.argv.push('--spindown-timeout=2147483647')
  Bare.argv.push('--runtime', RUNTIME)

  if (!cmd.args.verbose) Bare.argv.push('--verbose')
  require('../sidecar')

  print('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  print('Current process is now Sidecar', true)
  print(ansi.gray('Version: ' + JSON.stringify(CHECKOUT, 0, 4).slice(0, -1) + '  }'), 0)
  if (restarts.length > 0) {
    print('Restart Commands:', 0)
    for (const { id = null, dir, cmdArgs: cmdsig = [] } of restarts) {
      if (id !== null) continue
      let runix = cmdsig.indexOf('--run')
      if (runix === -1) runix = cmdsig.indexOf('--launch') // legacy alias
      const devix = cmdsig.indexOf('--dev')
      if (runix > -1) {
        const key = cmdsig[runix + 1]
        cmdsig.splice(runix, 2)
        cmdsig.unshift('run', key)
      } else if (devix > -1) {
        cmdsig[devix] = 'dev'
        if (cmdsig[devix + 1][0] !== '/' && cmdsig[devix + 1][0] !== '.') {
          cmdsig.splice(devix + 1, 0, dir)
        }
        const insix = cmdsig.indexOf('--inspector-port')
        cmdsig.splice(insix, 2)
      }
      const swapix = cmdsig.indexOf('--swap')
      if (swapix > -1) cmdsig.splice(swapix, 2)
      stdio.out.write('  ')
      if (cmdsig[0] === 'seed' && cmdsig.some(([ch]) => ch === '/' || ch === '.') === false) cmdsig[cmdsig.length] = dir
      print(ansi.gray('pear ' + cmdsig.join(' ')), 0)
    }
  }

  print('\n========================= RUN ====================================\n')
}
