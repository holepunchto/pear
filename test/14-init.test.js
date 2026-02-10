'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const init = require('../init')

test('init uses custom template defaults (#747)', async function ({
  ok,
  is,
  plan,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(4)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const templateDir = Helper.fixture('custom-template-defaults')
  const outDir = await tmp()
  teardown(() => Helper.gc(outDir))

  const output = await init(templateDir, outDir, {
    cwd: os.cwd(),
    ipc: helper,
    autosubmit: true,
    defaults: { name: 'test-app', height: 540, width: 720 },
    header: '',
    force: true,
    pkg: null
  })

  let success = false
  for await (const msg of output) {
    if (msg.tag === 'error') throw new Error(msg.data?.stack || msg.data?.message)
    if (msg.tag === 'final') {
      success = msg.data.success
      break
    }
  }

  ok(success, 'init completed successfully')

  const raw = await fs.promises.readFile(path.join(outDir, 'package.json'), 'utf8')
  const pkg = JSON.parse(raw)
  is(pkg.name, 'test-app', 'name from passed defaults should be used')
  is(
    pkg.pear.gui.height,
    1080,
    'template default for height (1080) should be used, not hardcoded 540'
  )
  is(pkg.pear.gui.width, 800, 'template default for width (800) should be used, not hardcoded 720')
})
