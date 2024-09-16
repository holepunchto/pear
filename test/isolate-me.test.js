const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')

const dir = path.join(fs.realpathSync(os.tmpdir()), 'tmp-pear-isolate')
global.Pear.teardown(async () => {
  fs.promises.rm(dir, { recursive: true }).catch(() => {})
})
