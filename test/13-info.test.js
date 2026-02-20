'use strict'
const env = require('bare-env')
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

const TEST_TIMEOUT = env.CI ? 120000 : 60000

test('pear info on unseeded key shows empty', async ({ ok, comment, teardown }) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const randomKey = hypercoreid.encode(Buffer.alloc(32, 0xab))
  const link = `pear://${randomKey}`

  comment('pear info unseeded link')
  const infoStream = helper.info({ link, cmdArgs: [] })
  teardown(() => Helper.teardownStream(infoStream))

  const until = await Helper.pick(infoStream, [{ tag: 'empty' }, { tag: 'final' }])

  const empty = await until.empty
  ok(empty, 'empty tag pushed for unseeded key')

  const final = await until.final
  ok(final, 'stream completed with final tag')
})

test.solo('pear info seeded link returns info', async ({ ok, is, comment, teardown, timeout }) => {
  timeout(TEST_TIMEOUT)
  const dir = Helper.fixture('hello-world')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const link = await Helper.touchLink(helper)
  comment('staging source app')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')
  comment('seeding source app')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const seeded = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seeded.announced

  const info = helper.info({ link, cmdArgs: [] })
  teardown(() => Helper.teardownStream(info))

  const until = await Helper.pick(info, [{ tag: 'info' }, { tag: 'final' }])
  is((await until.info).link, link)
})
