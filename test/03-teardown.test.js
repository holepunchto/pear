const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const harness = path.join(Helper.root, 'test', 'fixtures', 'harness')

test('teardown', async function ({ is, ok, plan, comment, teardown, timeout }) {
  timeout(180000)

  plan(5)

  const stager = new Helper()
  await stager.ready()

  const dir = harness

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

  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(announced, 'seeding is announced')

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate('Pear.teardown(() => console.log(\'teardown\'))')

  await running.inspector.close()
  running.subprocess.kill('SIGINT')

  const td = await running.until.teardown
  is(td, 'teardown', 'teardown has been triggered')

  const { code } = await running.until.exit
  is(code, 130, 'exit code is 130')
})

test('teardown during teardown', async function ({ is, ok, plan, comment, teardown }) {
  plan(5)

  const stager = new Helper()
  await stager.ready()

  const dir = harness

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

  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(announced, 'seeding is announced')

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['teardown', 'exit'] })

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

// TODO: fixme
test.skip('exit with non-zero code in teardown', async function ({ is, ok, plan, comment, teardown }) {
  plan(4)

  const stager = new Helper()
  await stager.ready()

  const dir = harness

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

  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(announced, 'seeding is announced')

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate('Pear.teardown(() => Pear.exit(124))')

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  // running.subprocess.kill('SIGINT') <-- this was forcing the exit code, which false-positives the test

  const { code } = await running.until.exit
  is(code, 124, 'exit code is 124')
})
