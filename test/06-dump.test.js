'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const Localdrive = require('localdrive')

const Helper = require('./helper')

test('pear dump', async function ({ ok, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(out)
  ok(await dumped.exists('/index.js'), 'index.js should exist')
  ok(await dumped.exists('/package.json'), 'package.json should exist')
})

test('pear dump dumping subdirectory', async function ({
  ok,
  absent,
  plan,
  teardown
}) {
  plan(4)
  const path = require('bare-path')
  const fs = require('bare-fs')
  const exists = (path) =>
    fs.promises.stat(path).then(
      () => true,
      () => false
    )
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir: Helper.fixture('dump'),
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/lib`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(out)
  absent(await dumped.exists('/index.js'), 'index.js should not exist')
  absent(await dumped.exists('/package.json'), 'package.json should not exist')
  ok(await dumped.exists('/lib/dump.js'), 'lib/dump.js should exist')
  ok(await dumped.exists('/lib/pear.js'), 'lib/pear.js should exist')
})

test('pear dump dumping to existing dir', async function ({
  absent,
  is,
  plan,
  teardown
}) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const out = await tmp()
  const dumped = new Localdrive(out)
  await dumped.put('/test.txt', 'hello')

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out })
  teardown(() => Helper.teardownStream(dump))
  try {
    const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
    await untilDump.complete
  } catch (e) {
    is(e.code, 'ERR_DIR_NONEMPTY', 'should error with non-empty directory')
  }

  absent(await dumped.exists('/index.js'), 'index.js should not exist')
  absent(await dumped.exists('/package.json'), 'package.json should not exist')
})

test('pear dump dumping to existing dir with force', async function ({
  ok,
  plan,
  teardown
}) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`
  const out = await tmp()

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out, force: true })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(out)
  ok(await dumped.exists('/index.js'), 'index.js should exist')
  ok(await dumped.exists('/package.json'), 'package.json should exist')
})

test('pear dump dumping a single file', async function ({
  ok,
  absent,
  is,
  plan,
  teardown
}) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/index.js`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(out)
  ok(await dumped.exists('/index.js'), 'index.js should exist')
  let dirCount = 0
  for await (const _ of dumped.readdir()) dirCount++
  is(dirCount, 1)
  absent(await dumped.exists('/package.json'), 'package.json should not exist')
})

test('pear dump dumping a single file in a subdirectory', async function ({
  ok,
  is,
  plan,
  teardown
}) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/lib/dump.js`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  const dump = await helper.dump({ link, dir: out })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(out)
  let dirCount = 0
  for await (const _ of dumped.readdir()) dirCount++
  ok(await dumped.exists('/lib/dump.js'), 'lib/dump.js should exist')
  is(dirCount, 1, 'should have only one file in the lib directory')
})

test('pear dump dumping to stdout', async function ({ ok, plan, teardown }) {
  plan(4)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const dumpedFiles = []
  const dump = await helper.dump({ link, dir: '-' })
  teardown(() => Helper.teardownStream(dump))
  for await (const output of dump) {
    if (output.tag === 'file') dumpedFiles.push(output.data.key)
    if (output.tag === 'final') break
  }

  ok(dumpedFiles.includes('/index.js'), 'should print out index.js')
  ok(dumpedFiles.includes('/package.json'), 'should print out package.json')
  ok(dumpedFiles.includes('/lib/pear.js'), 'should print out lib/pear.js')
  ok(dumpedFiles.includes('/lib/dump.js'), 'should print out lib/dump.js')
})

test('pear dump dumping subdirectory to stdout', async function ({
  ok,
  plan,
  teardown
}) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/lib`

  const dumpedFiles = []
  const dump = await helper.dump({ link, dir: '-' })
  teardown(() => Helper.teardownStream(dump))
  for await (const output of dump) {
    if (output.tag === 'file') dumpedFiles.push(output.data.key)
    if (output.tag === 'final') break
  }

  ok(
    dumpedFiles.includes('/pear.js'),
    'should print out lib/pear.js as /pear.js'
  )
  ok(
    dumpedFiles.includes('/dump.js'),
    'should print out lib/dump.js as /dump.js'
  )
})

test('pear dump dumping a single file to stdout', async function ({
  ok,
  absent,
  is,
  plan,
  teardown
}) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/index.js`

  const dumpedFiles = []
  const dump = await helper.dump({ link, dir: '-' })
  teardown(() => Helper.teardownStream(dump))
  for await (const output of dump) {
    if (output.tag === 'file') dumpedFiles.push(output.data.key)
    if (output.tag === 'final') break
  }

  ok(dumpedFiles.includes('index.js'), 'should print out index.js')
  is(dumpedFiles.length, 1, 'should dump only one file')
  absent(
    dumpedFiles.includes('package.json'),
    'should not print out package.json'
  )
})

test('pear dump dumping a single file in a subdirectory to stdout', async function ({
  ok,
  absent,
  is,
  plan,
  teardown
}) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/lib/pear.js`

  const dumpedFiles = []
  const dump = await helper.dump({ link, dir: '-' })
  teardown(() => Helper.teardownStream(dump))
  for await (const output of dump) {
    if (output.tag === 'file') dumpedFiles.push(output.data.key)
    if (output.tag === 'final') break
  }

  ok(dumpedFiles.includes('pear.js'), 'should print out pear.js')
  is(dumpedFiles.length, 1, 'should dump only one file')
  absent(dumpedFiles.includes('index.js'), 'should not print out index.js')
})

test('pear dump should throw when dumping non-existant filepath', async function ({
  plan,
  teardown,
  exception
}) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/doesnt-exists.js`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  await exception(async () => {
    const dump = helper.dump({ link, dir: out })
    teardown(() => Helper.teardownStream(dump))
    const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
    await untilDump.complete
  })
})

test('pear dump should throw when dumping non-existant dirpath', async function ({
  plan,
  teardown,
  exception
}) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = Helper.fixture('dump')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/no-dir`

  const out = await tmp()

  teardown(() => Helper.gc(out))
  await exception(async () => {
    const dump = helper.dump({ link, dir: out })
    teardown(() => Helper.teardownStream(dump))
    const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
    await untilDump.complete
  })
})
