'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

const isWindows = global.Bare.platform === 'win32'

test('teardown', { skip: isWindows }, async function ({ is, ok, plan, comment, teardown, timeout }) {
  timeout(180000)

  plan(5)

  const stager = new Helper()
  await stager.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const stage = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const final = await Helper.pick(stage, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.shutdown())
  await seeder.ready()
  const seed = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir })
  const until = await Helper.pick(seed, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  const announced = await until.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const running = await Helper.open(key, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate(
    `(() => {
        const { teardown } = Pear;
        teardown(() => console.log('teardown'));
    })()`)

  await running.inspector.close()
  running.subprocess.kill('SIGINT')

  const td = await running.until.teardown
  is(td, 'teardown', 'teardown has been triggered')

  const { code } = await running.until.exit
  is(code, 130, 'exit code is 130')
})

test('teardown during teardown', { skip: isWindows }, async function ({ is, ok, plan, comment, teardown }) {
  plan(5)

  const stager = new Helper()
  await stager.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const stage = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const final = await Helper.pick(stage, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.shutdown())
  await seeder.ready()
  const seed = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir })
  const until = await Helper.pick(seed, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  const announced = await until.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const running = await Helper.open(key, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate(
    `(() => {
        const { teardown } = Pear
        const a = () => { b() }
        const b = () => { teardown(() => console.log('teardown from b')) }
        teardown( () => a() )
    })()`)

  await running.inspector.close()
  running.subprocess.kill('SIGINT')

  const td = await running.until.teardown
  is(td, 'teardown from b', 'teardown from b has been triggered')

  const { code } = await running.until.exit
  is(code, 130, 'exit code is 130')
})

test('exit code', { skip: isWindows }, async function ({ is, ok, plan, comment, teardown }) {
  plan(4)

  const stager = new Helper()
  await stager.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const stage = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const final = await Helper.pick(stage, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.shutdown())
  await seeder.ready()
  const seed = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir })
  const until = await Helper.pick(seed, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  const announced = await until.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const running = await Helper.open(key, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate(
    `(() => {
        const { teardown } = Pear;
        teardown(() => global.Bare.exit(124));
    })()`)

  await running.inspector.evaluate('(() => { return global.__PEAR_TEST__.running.inspector.disable() })()')
  await running.inspector.close()
  running.subprocess.kill('SIGINT')

  const { code } = await running.until.exit
  is(code, 124, 'exit code is 124')
})
