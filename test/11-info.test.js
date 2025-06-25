'use strict'
const test = require('brittle')
const Helper = require('./helper')
const tmp = require('test-tmp')
const fs = require('bare-fs/promises')
const path = require('bare-path')
const skippingInfoLinkDir = path.join(Helper.localDir, 'test', 'fixtures', 'skipping-info-link')

test('Pear.info but skip link arg', async function ({ teardown, execution, plan, comment }) {
  plan(1)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const pkg = { name: 'tmp-app', main: 'index.js', pear: { name: 'tmp-app', type: 'terminal' } }
  await fs.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkg))
  await fs.copyFile(path.join(skippingInfoLinkDir, 'index.js'), path.join(tmpdir, 'index.js'))

  comment('running app with info')
  const run = await Helper.run({link: tmpdir})
  await execution(async () => {await Helper.untilResult(run.pipe)})
})
