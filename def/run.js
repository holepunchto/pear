'use strict'
const { flag, arg, rest } = require('paparam')

const flags = [
  flag('--dev|-d', 'Enable --devtools & --updates-diff'),
  flag('--devtools', 'Open devtools with application [Desktop]'),
  flag('--updates-diff', 'Enable diff computation for Pear.updates'),
  flag('--no-updates', 'Disable updates firing via Pear.updates'),
  flag('--link <url>', 'Simulate deep-link click open'),
  flag('--store|-s <path>', 'Set the Application Storage path'),
  flag('--tmp-store|-t', 'Automatic new tmp folder as store path'),
  flag('--links <kvs>', 'Override configured links with comma-separated key-values'),
  flag('--chrome-webrtc-internals', 'Enable chrome://webrtc-internals'),
  flag('--unsafe-clear-app-storage', 'Clear app storage'),
  flag('--appling <path>', 'Set application shell path'),
  flag('--checkout <n|release|staged>', 'Run a checkout from version length'),
  flag('--detached', 'Wakeup existing app or run detached'),
  flag('--no-ask', 'Suppress permissions dialog'),
  flag('--dht-bootstrap <nodes>', 'DHT boostrap').hide(),
  flag('--trusted').hide(),
  flag('--detach').hide(),
  flag('--swap <path>').hide(),
  flag('--start-id <id>').hide(),
  flag('--sandbox').hide(), // electron passthrough
  flag('--app-name <name>').hide()
]

module.exports = [
  arg('<link|dir>', 'Pear link, alias or directory to run app from'),
  rest('[...app-args]', 'Application arguments'),
  ...flags
]

module.exports.flags = flags
