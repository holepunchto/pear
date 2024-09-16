'use strict'
import path from 'bare-path'
import fs from 'bare-fs'
import os from 'bare-os'
import bootstrap from 'pear-updater-bootstrap'

const [key] = global.Pear.config.args
const tmp = fs.realpathSync(os.tmpdir())

console.log('# bootstrapping from', key)

console.log('# bootstrapping tmp-pear artifact')
await bootstrap(key, path.join(tmp, 'tmp-pear'))

console.log('# bootstrapping rcv-pear artifact')
await bootstrap(key, path.join(tmp, 'rcv-pear'))
