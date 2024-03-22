'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('smoke', async function ({ ok, is, plan, comment }) {
  plan(5)

  const helper = new Helper()
  await helper.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const stage = Helper.pickMany(helper.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true }, { close: false }), [{ tag: 'final' }])
  const final = await stage.final
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seed = Helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  const announced = await until.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const { inspector, pick } = await Helper.open(key, { tags: ['exit'] })

  const running = await Helper.open(key, { tags: ['exit'] })

  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })

  is(value?.app?.key, key, 'app version matches staged key')

  await inspector.close()
  await helper._close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
