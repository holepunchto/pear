'use strict'
const { flag, hiddenFlag } = require('paparam')

module.exports = [
  flag('-v', 'Print version'),
  flag('--log-level <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
  flag('--log-labels <list>', 'Labels to log (internal, always logged)'),
  flag('--log-fields <list>', 'Show/hide: date,time,h:level,h:label,h:delta'),
  flag('--log-stacks', 'Add a stack trace to each log message'),
  flag('--log', 'Label:sidecar Level:2 Fields: h:level,h:label'),
  flag('--sidecar', 'Boot Sidecar'),
  hiddenFlag('--run'), // appling legacy
  hiddenFlag('--sandbox'), // appling legacy
  hiddenFlag('--appling'), // appling legacy
  hiddenFlag('--dht-bootstrap <nodes>')
]
