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

test('pear info seeded link returns info', async ({ ok, is, comment, teardown, timeout }) => {
  timeout(TEST_TIMEOUT)
  const dir = Helper.fixture('hello-world')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging source app')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const stageFinal = await Helper.pick(staging, { tag: 'final' })
  ok(stageFinal?.success, 'stage succeeded')

  comment('seeding source app')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const seeded = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seeded.announced
  const key = await seeded.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const infoStream = helper.info({ link, cmdArgs: [] })
  teardown(() => Helper.teardownStream(infoStream))

  const until = await Helper.pick(infoStream, [{ tag: 'info' }, { tag: 'final' }])
  const info = await until.info
  ok(!!info, 'info payload is present')
  if (!info) return
  is(info.channel, `test-${id}`, 'channel matches staged app')
  await until.final
  ok(true, 'final tag emitted')
})
