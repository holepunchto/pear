'use strict'
const { flag, command, arg, rest } = require('paparam')

const definition = [
  flag('-v', 'Print version'),
  flag('--log-level|-L <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
  flag('--sidecar', 'Raw boot Sidecar'),
  flag('--dht-bootstrap <nodes>').hide()
]

module.exports = {
  definition,
  command: (argv) =>
    command('pear', ...definition, arg('[cmd]'), rest('rest')).parse(argv, { silent: true })
}
