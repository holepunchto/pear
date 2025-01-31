'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fs = require('bare-fs')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'hello-world')

const exists = (path) => fs.promises.stat(path).then(() => true, () => false)

test('dump should succeed', async function ({ ok, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const dir = path.join(Helper.tmp, 'pear-dump-test-1')

  teardown(() => Helper.gc(dir))
  const dump = await helper.dump({ link, dir })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(exists(path.join(dir, 'index.js')), 'index.js should exist')
  ok(exists(path.join(dir, 'package.json')), 'package.json should exist')
})

test('dump should fail when dumping to existing dir', async function ({ not, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const dir = path.join(Helper.tmp, 'pear-dump-test-2')
  await fs.promises.mkdir(dir)

  teardown(() => Helper.gc(dir))
  const dump = await helper.dump({ link, dir })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  not(exists(path.join(dir, 'index.js')), 'index.js should not exist')
  not(exists(path.join(dir, 'package.json')), 'package.json should not exist')
})

test('dump should succeed when dumping to existing dir with force', async function ({ ok, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const dir = path.join(Helper.tmp, 'pear-dump-test-3')
  await fs.promises.mkdir(dir)

  teardown(() => Helper.gc(dir))
  const dump = await helper.dump({ link, dir, force: true })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(exists(path.join(dir, 'index.js')), 'index.js should exist')
  ok(exists(path.join(dir, 'package.json')), 'package.json should exist')
})

test('dump should succeed when dumping a single file', async function ({ not, ok, is, plan, teardown }) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/index.js`

  const dir = path.join(Helper.tmp, 'pear-dump-test-4')

  teardown(() => Helper.gc(dir))
  const dump = await helper.dump({ link, dir })
  teardown(() => Helper.teardownStream(dump))
  const untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(exists(path.join(dir, 'index.js')), 'index.js should exist')
  is((await fs.promises.readdir(dir)).length, 1)
  not(exists(path.join(dir, 'package.json')), 'package.json should not exist')
})

test('dump should succeed when dumping to stdout', async function ({ ok, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
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
})

test('dump should succeed when dumping a single file to stdout', async function ({ ok, not, is, plan, teardown }) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
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
  not(dumpedFiles.includes('package.json'), 'should not print out package.json')
})
