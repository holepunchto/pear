'use strict'
const { flag, command, arg, rest } = require('paparam')

const definition = [
  flag('-v', 'Print version'),
  flag('--log-labels|-l <list>', 'Labels to log. If set, implies --log'),
  flag('--log-level|-L <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
  flag('--log-max|-M', 'Log all levels and labels'),
  flag('--log', 'Default logs: -l sidecar -L 2'),
  flag('--sidecar', 'Raw boot Sidecar'),
  flag('--dht-bootstrap <nodes>').hide()
]

module.exports = {
  definition,
  command: (argv) =>
    command('pear', ...definition, arg('[cmd]'), rest('rest')).parse(argv, { silent: true })
}
