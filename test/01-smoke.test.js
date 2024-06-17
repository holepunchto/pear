'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('smoke', async function ({ ok, is, plan, comment, teardown }) {
  plan(5)
  const stager = new Helper()
  await stager.ready()
  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(async () => seeder.shutdown())
  await seeder.ready()
  const seeding = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  const announced = await until.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')

  const running = await Helper.open(key, { tags: ['exit'] }, { isWorker: true })

  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })

  is(value?.app?.key, key, 'app version matches staged key')

  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})
