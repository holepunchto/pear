'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const { spawn } = require('bare-subprocess')
const { RUNTIME } = require('pear-constants')
const { Duplex } = require('streamx')
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
function trimAnsi(str) {
  return str.replaceAll('\x1b[?25l', '').replaceAll('\x1b[?25h', '')
}

async function run({ link, args = [], argv = [] }) {
  const sp = spawn(RUNTIME, ['run', ...argv, '--trusted', link, ...args], {
    stdio: ['inherit', 'pipe', 'inherit'],
    windowsHide: true
  })

  const pipe = new Duplex()
  sp.once('exit', (exitCode) => {
    if (exitCode !== 0) pipe.emit('crash', { exitCode })
  })
  sp.stdout.on('data', (data) => {
    for (const line of data.toString().split(/\r?\n/g)) {
      if (trimAnsi(line).trim().length === 0) continue
      pipe.push({ type: 'stdout', data: line })
    }
  })
  sp.stdout.on('end', () => {
    pipe.end()
  })

  return { pipe }
}

test.hook('pre setup', rig.setup)

test('pre should update config when running locally', async function ({
  ok,
  is,
  plan,
  comment
}) {
  plan(4)

  comment('\trunning')
  const { pipe } = await run({ link: preConfigure })

  const preResult = await Helper.untilData(pipe)
  is(preResult.type, 'stdout', 'should output to stdout')
  ok(preResult.data.includes('configure'), 'pre should run configure step')

  const result = await Helper.untilData(pipe)
  is(result.type, 'stdout', 'should output to stdout')
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
  const { pipe } = await run({ link })

  const result = await Helper.untilData(pipe)
  is(result.type, 'stdout', 'should output to stdout')
  is(
    result.data,
    '{"name":"pre-configure-did-not-run"}',
    'pre should have original name in config'
  )

  await Helper.untilClose(pipe)
})

test.hook('pre cleanup', rig.cleanup)
