'use strict'
const env = require('bare-env')
const test = require('brittle')
const Helper = require('./helper')

const TEST_TIMEOUT = env.CI ? 120000 : 60000

test('pear changelog without link returns platform changelog', async ({ not, teardown }) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const info = helper.info({ link: null, changelog: { max: 1 }, cmdArgs: [] })
  teardown(() => Helper.teardownStream(info))

  const data = await Helper.pick(info, { tag: 'changelog' })
  not(data.changelog, '[ No Changelog ]')
})

test('pear changelog with link', async ({ ok, is, teardown, timeout }) => {
  timeout(TEST_TIMEOUT)
  const dir = Helper.fixture('minimal')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const link = await Helper.touchLink(helper)
  const staging = helper.stage({ link, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  const seeding = helper.seed({ link, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const seeded = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seeded.announced

  const info = helper.info({ link, changelog: { max: 1 }, cmdArgs: [] })
  teardown(() => Helper.teardownStream(info))

  const data = await Helper.pick(info, { tag: 'changelog' })
  is(data.version, 'v1.0.0')
  is(data.changelog, '## v1.0.0\n\nInitial release.')
})
