'use strict'
const { flag, command, arg, rest } = require('paparam')

const definition = [
  flag('-v', 'Print version'),
  flag('--log-labels|-l <list>', 'Labels to log. If set, implies --log'),
  flag('--log-level|-L <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
  flag('--log-fields|-F <list>', 'Show/hide: date,time,h:level,h:label,h:delta'),
  flag('--log-verbose|-V', 'Log with all fields enabled'),
  flag('--log-stacks|-S', 'Add a stack trace to each log message'),
  flag('--log-max|-M', 'Log with all levels, logs and fields'),
  flag('--log', 'Default logs: -l sidecar -L 2 -F h:level,h:label'),
  flag('--sidecar', 'Raw boot Sidecar'),
  flag('--run').hide(), // appling legacy
  flag('--sandbox').hide(), // appling legacy
  flag('--appling').hide(), // appling legacy
  flag('--rti <info>').hide(),
  flag('--key <key>', 'Advanced. Switch release lines').hide(),
  flag('--mem', 'Memory mode: RAM corestore').hide(),
  flag('--dht-bootstrap <nodes>').hide()
]

module.exports = {
  definition,
  command: (argv) =>
    command('pear', ...definition, arg('[cmd]'), rest('rest')).parse(argv, { silent: true })
}
