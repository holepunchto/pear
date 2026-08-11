'use strict'
const { flag, command, arg, rest } = require('paparam')

const definition = [
  flag('-v', 'Print version'),
  flag('--log-level|-L <level>', 'Verbosity to log at — 0=off, 1=error, 2=info, or 3=trace'),
  flag('--sidecar', 'Internal. Boot this process as the sidecar').hide(),
  flag('--dht-bootstrap <nodes>').hide(),
  flag('--menu', 'Interactive command picker').hide()
]

module.exports = {
  definition,
  command: (argv) =>
    command('pear', ...definition, arg('[cmd]'), rest('rest')).parse(argv, {
      // Used only for bootstrap flag extraction. Defer unknown flags and other CLI errors to the main parser.
      bails: false
    })
}
