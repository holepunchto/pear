'use strict'
const { flag, hiddenFlag, arg, rest } = require('paparam')

module.exports = [
  arg('<link|dir>', 'Pear link, alias or directory to run app from'),
  rest('[...app-args]', 'Application arguments'),
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
  flag('--unsafe-clear-preferences', 'Clear preferences (such as trustlist)'),
  flag('--appling <path>', 'Set application shell path'),
  flag('--checkout <n|release|staged>', 'Run a checkout from version length'),
  flag('--detached', 'Wakeup existing app or run detached'),
  flag('--no-ask', 'Suppress permissions dialog'),
  hiddenFlag('--encryption-key <name>', 'Application encryption key'),
  hiddenFlag('--trusted'),
  hiddenFlag('--detach'),
  hiddenFlag('--trace <n>'),
  hiddenFlag('--swap <path>'),
  hiddenFlag('--start-id <id>'),
  hiddenFlag('--sandbox') // enable electron/chromium sandbox
]
