'use strict'
const test = require('brittle')
const path = require('bare-path')
const fs = require('bare-fs')
const Helper = require('./helper')

const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const tmp = require('test-tmp')

const warmup = path.join(Helper.localDir, 'test', 'fixtures', 'warmup')
const desktop = path.join(Helper.localDir, 'test', 'fixtures', 'desktop-warmup')
const prefetch = path.join(Helper.localDir, 'test', 'fixtures', 'warmup-with-prefetch')
const appWithoutMain = path.join(Helper.localDir, 'test', 'fixtures', 'app-without-main')
const appWithIgnore = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-ignore')
const appWithSubdir = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-subdir')
const appWithPurge = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-purge')

test('stage warmup with entrypoints', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = warmup

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('stage desktop app warmup with entrypoints', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = desktop

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('stage warmup with prefetch', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = prefetch

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('staged bundle contains entries metadata', async function ({ ok, is, plan, comment, teardown, timeout }) {
  plan(2)

  const dir = appWithoutMain

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  await staged.final

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  await until.announced

  const swarm = new Hyperswarm({ bootstrap: Pear.config.dht.bootstrap })
  const tmpdir = await tmp()
  const store = new Corestore(tmpdir)
  await store.ready()
  const drive = new Hyperdrive(store, key)
  await drive.ready()

  teardown(() => swarm.destroy())

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)

  await new Promise((resolve) => setTimeout(resolve, 500))

  comment('bundle entries should contain metadata')
  for await (const file of drive.list()) {
    if (file.key === '/app.js' || file.key === '/dep.js') {
      const entry = await drive.entry(file.key)
      ok(entry.value.metadata)
    }
  }
})

test('stage with ignore', async function ({ ok, is, plan, comment, teardown }) {
  const dir = appWithIgnore

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 6)
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/app.js'))
  ok(stagingFiles.includes('/index.html'))
  ok(stagingFiles.includes('/ignore-dir1/dont-ignore.txt'))
  ok(stagingFiles.includes('/ignore-dir1/other-dont-ignore.js'))
})

test('stage negated ignore', async function ({ ok, is, plan, comment, teardown }) {
  const dir = appWithIgnore

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  let staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, ignore: '!ignore-file.js,!ignore-dir1/*.js,!ignore-dir2/*.txt' })
  teardown(() => Helper.teardownStream(staging))

  let stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  let staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 10, 'should stage 10 files')
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/app.js'))
  ok(stagingFiles.includes('/index.html'))
  ok(stagingFiles.includes('/ignore-file.js'))
  ok(stagingFiles.includes('/ignore-dir1/ignore-dir1-file.js'))
  ok(stagingFiles.includes('/ignore-dir1/dont-ignore.txt'))
  ok(stagingFiles.includes('/ignore-dir1/other-dont-ignore.js'))
  ok(stagingFiles.includes('/ignore-dir2/other-file.txt'))
  ok(stagingFiles.includes('/ignore-dir2/other-other-file.txt'))

  staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, purge: false, ignore: '!*' })
  teardown(() => Helper.teardownStream(staging))

  stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 2, 'should stage one more file')
  ok(stagingFiles.includes('/ignore-dir2/ignore-dir2-file.js'))
  ok(stagingFiles.includes('/ignore-dir1/ignore-file.txt'))
})

test('stage with purge', async function ({ ok, is, plan, comment, teardown }) {
  const exists = (path) => fs.promises.stat(path).then(() => true, () => false)
  const dir = appWithSubdir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('normal stage')
  const id = Helper.getRandomId()

  let staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  let staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 6, 'should stage 6 files')
  ok(stagingFiles.includes('/package.json'), 'package.json should exists')
  ok(stagingFiles.includes('/index.js'), 'index.js should exist')
  ok(stagingFiles.includes('/purge-file.js'), 'purge-file.js should exist')
  ok(stagingFiles.includes('/purge-dir1/purge-dir1-file.js'), 'purge-dir1/purge-dir1-file.js should exist')
  ok(stagingFiles.includes('/purge-dir1/purge-subdir/purge-subdir-file.js'), 'purge-dir1/purge-subdir/purge-subdir-file.js should exist')
  ok(stagingFiles.includes('/purge-dir2/purge-dir2-file.js'), 'purge-dir2/purge-dir2-file.js should exist')

  comment('check dry-run purge doesnt purge')
  staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: true, ignore: 'purge-file.js,purge-dir1,purge-dir2', purge: true })
  teardown(() => Helper.teardownStream(staging))

  let removed
  staging.on('data', async (data) => {
    if (data?.tag === 'summary') {
      removed = data.data.remove
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(removed, 0, 'dry-run purge should NOT remove files')

  comment('check ignore doesn\'t purge')
  staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, ignore: 'purge-file.js,purge-dir1,purge-dir2', purge: false })
  teardown(() => Helper.teardownStream(staging))

  const stagedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff' && data?.data.type === -1) {
      stagedFiles.push(data.data.message)
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(stagedFiles.length, 0, 'ignore should NOT purge files')

  comment('check dump')
  const { key } = await staged.addendum
  const link = `pear://${key}`
  const dumpDir = path.join(Helper.tmp, 'pear-dump-purge')

  let dump = await helper.dump({ link, dir: dumpDir, force: true })
  teardown(() => Helper.teardownStream(dump))

  let untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(await exists(path.join(dumpDir, 'package.json')), 'package.json should exist')
  ok(await exists(path.join(dumpDir, 'index.js')), 'index.js should exist')
  ok(await exists(path.join(dumpDir, 'purge-file.js')), 'purge-file.js should exist')
  ok(await exists(path.join(dumpDir, 'purge-dir1', 'purge-dir1-file.js')), 'purge-dir1/purge-dir1-file.js should exist')
  ok(await exists(path.join(dumpDir, 'purge-dir1', 'purge-subdir', 'purge-subdir-file.js')), 'purge-dir1/purge-subdir/purge-subdir-file.js should exist')
  ok(await exists(path.join(dumpDir, 'purge-dir2', 'purge-dir2-file.js')), 'purge-dir2/purge-dir2-file.js should exist')

  comment('purge')
  staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, ignore: 'purge-file.js,purge-dir1,purge-dir2', purge: true })
  teardown(() => Helper.teardownStream(staging))

  const removedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff' && data?.data.type === -1) {
      removedFiles.push(data.data.message)
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(removedFiles.length, 4, 'adding ignore without dry-run should purge 4 files')
  ok(removedFiles.includes('/purge-file.js'), 'purge-file.js should be purged')
  ok(removedFiles.includes('/purge-dir1/purge-dir1-file.js'), 'purge-dir1/purge-dir1-file.js should be purged')
  ok(removedFiles.includes('/purge-dir1/purge-subdir/purge-subdir-file.js'), 'purge-dir1/purge-subdir/purge-subdir-file.js should be purged')
  ok(removedFiles.includes('/purge-dir2/purge-dir2-file.js'), 'purge-dir2/purge-dir2-file.js should be purged')

  comment('check dump after purge')
  dump = await helper.dump({ link, dir: dumpDir, force: true })
  teardown(() => Helper.teardownStream(dump))
  untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(await exists(path.join(dumpDir, 'package.json')), 'package.json should exist')
  ok(await exists(path.join(dumpDir, 'index.js')), 'index.js should exist')
  ok(!await exists(path.join(dumpDir, 'purge-file.js')), 'purge-file.js should NOT exist')
  ok(!await exists(path.join(dumpDir, 'purge-dir1', 'purge-dir1-file.js')), 'purge-dir1/purge-dir1-file.js should NOT exist')
  ok(!await exists(path.join(dumpDir, 'purge-dir1', 'purge-subdir', 'purge-subdir-file.js')), 'purge-dir1/purge-subdir/purge-subdir-file.js should NOT exist')
  ok(!await exists(path.join(dumpDir, 'purge-dir2', 'purge-dir2-file.js')), 'purge-dir2/purge-dir2-file.js should NOT exist')
})

test('stage with purge config', async function ({ ok, is, plan, comment, teardown }) {
  const dir = appWithPurge

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('normal stage')
  const id = Helper.getRandomId()

  let staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  let staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 4, 'should stage 4 files')
  ok(stagingFiles.includes('/package.json'), 'package.json should exists')
  ok(stagingFiles.includes('/index.js'), 'index.js should exist')
  ok(stagingFiles.includes('/not-purged.js'), 'not-purged.js should exist')
  ok(stagingFiles.includes('/config-purge-file.js'), 'config-purge-file.js should exist')

  comment('purge')
  staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, ignore: 'ignored-from-start.js,config-purge-file.js' })
  teardown(() => Helper.teardownStream(staging))

  const removedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff' && data?.data.type === -1) {
      removedFiles.push(data.data.message)
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  is(removedFiles.length, 1, 'should remove 1 file')
  ok(removedFiles.includes('/config-purge-file.js'), 'config-purge-file.js should be purged')
})
