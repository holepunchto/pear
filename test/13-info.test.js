'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

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
