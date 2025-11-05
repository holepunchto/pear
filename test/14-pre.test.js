'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const preConfigure = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'pre-configure'
)
const seedOpts = (id, dir) => ({
  channel: `test-${id}`,
  name: `test-${id}`,
  key: null,
  dir,
  cmdArgs: []
})
const stageOpts = (id, dir) => ({
  ...seedOpts(id, dir),
  dryRun: false,
  ignore: []
})

const rig = new Helper.Rig()

test.hook('pre setup', rig.setup)

test('pre should update config when running locally', async function ({
  ok,
  is,
  plan,
  comment
}) {
  plan(4)

  comment('\trunning')
  const { pipe } = await Helper.runStdio({ link: preConfigure })

  const preResult = await Helper.untilData(pipe)
  is(preResult.tag, 'stdout', 'should output to stdout')
  ok(preResult.data.includes('configure'), 'pre should run configure step')

  const result = await Helper.untilData(pipe)
  is(result.tag, 'stdout', 'should output to stdout')
  is(
    result.data,
    '{"name":"pre-configure-success"}',
    'pre should have updated name in config'
  )

  await Helper.untilClose(pipe)
})

test('pre should not update config when running staged', async function ({
  is,
  plan,
  comment,
  teardown
}) {
  plan(2)

  const testId = Helper.getRandomId()
  const stager = new Helper(rig)
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()

  comment('\tstaging')
  const staging = stager.stage(stageOpts(testId, preConfigure))
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [
    { tag: 'staging' },
    { tag: 'final' }
  ])
  const { link } = await until.staging
  await until.final

  comment('\trunning')
  const { pipe } = await Helper.runStdio({ link })

  const result = await Helper.untilData(pipe)
  is(result.tag, 'stdout', 'should output to stdout')
  is(
    result.data,
    '{"name":"pre-configure-did-not-run"}',
    'pre should have original name in config'
  )

  await Helper.untilClose(pipe)
})

test.hook('pre cleanup', rig.cleanup)
