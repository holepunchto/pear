'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const Localdrive = require('localdrive')
const Helper = require('./helper')

test('pear stage min desktop app', async ({ teardown, ok, is, comment }) => {
  const dir = Helper.fixture('stage-app-min')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(staging))

  const stagedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagedFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'warmed' }, { tag: 'final' }])
  const warmed = await staged.warmed
  ok(warmed.blocks > 0, 'Warmup contains some blocks')
  ok(warmed.total > 0, 'Warmup total is correct')
  is(warmed.success, true, 'Warmup completed')

  await staged.final

  const expectedStagedFiles = [
    '/package.json',
    '/app.js',
    '/index.js',
    '/index.html',
    '/node_modules/bare-events/package.json',
    '/node_modules/bare-events/index.js',
    '/node_modules/bare-events/lib/errors.js',
    '/node_modules/ready-resource/package.json',
    '/node_modules/ready-resource/index.js'
  ]

  comment('Only files in the dependency tree are staged')
  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})

test('pear stage min desktop app with entrypoints', async ({ teardown, ok, is, comment }) => {
  const dir = Helper.fixture('stage-app-min-with-entrypoints')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(staging))

  const stagedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagedFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'warmed' }, { tag: 'final' }])
  const warmed = await staged.warmed
  ok(warmed.blocks > 0, 'Warmup contains some blocks')
  ok(warmed.total > 0, 'Warmup total is correct')
  is(warmed.success, true, 'Warmup completed')
  await staged.final

  const expectedStagedFiles = [
    '/package.json',
    '/index.js',
    '/entrypoint.js',
    '/dep.js',
    '/assets/file1.txt',
    '/assets/file2.txt'
  ]

  comment('Only files in the dependency tree and assets are staged')
  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})

test('pear stage min desktop app with only and include', async ({ teardown, ok, is }) => {
  const dir = Helper.fixture('stage-app-min-with-only')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(staging))

  const stagedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagedFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'warmed' }, { tag: 'final' }])
  const warmed = await staged.warmed
  ok(warmed.blocks > 0, 'Warmup contains some blocks')
  ok(warmed.total > 0, 'Warmup total is correct')
  is(warmed.success, true, 'Warmup completed')
  await staged.final

  const expectedStagedFiles = [
    '/package.json',
    '/index.js',
    '/folder/foo.js',
    '/folder/bar.js',
    '/node_modules/ready-resource/package.json',
    '/node_modules/ready-resource/index.js',
    '/index.html',
    '/app.js'
  ]
  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})

test('pear stage pear.main file', async ({ teardown, ok, comment }) => {
  const dir = Helper.fixture('stage-pear-main')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(staging))

  const stagedFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagedFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  const expectedStagedFiles = ['/package.json', '/app.js']

  comment('Only files in the dependency tree are staged')

  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})

test('pear stage with ignore', async function ({ ok, is, teardown }) {
  const dir = Helper.fixture('app-with-ignore')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)

  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final
  is(stagingFiles.length, 5)
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/index.js'))
  ok(stagingFiles.includes('/ignore-dir1/dont-ignore.txt'))
  ok(stagingFiles.includes('/ignore-dir1/deep-glob-ignore.js'))
})

test('pear stage with glob ignores', async function ({ ok, is, teardown }) {
  const dir = Helper.fixture('app-with-ignore')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)

  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    ignore: '/**/*.js'
  })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 4)
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/index.js'))
  ok(stagingFiles.includes('/ignore-dir1/dont-ignore.txt'))
})

test('pear stage with ignore and unignore', async function ({ ok, is, teardown }) {
  const dir = Helper.fixture('app-with-unignore')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)

  let staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))

  let stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  let staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 9, 'should stage 9 files')
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/index.js'))
  ok(stagingFiles.includes('/modules-test/prebuilds-example/file.js'))
  ok(stagingFiles.includes('/modules-test/dir1/other.js'))
  ok(stagingFiles.includes('/modules-test/dir1/prebuilds-example/file1.js'))
  ok(stagingFiles.includes('/modules-test/dir1/prebuilds-example/file1.js'))
  ok(stagingFiles.includes('/modules-test/dir2/other/other.js'))
  ok(stagingFiles.includes('/modules-test/dir3/other.js'))
  ok(stagingFiles.includes('/modules-test/dir4/subdir/other.js'))

  staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    purge: false,
    ignore: '!/modules-test/**/prebuilds-example'
  })
  teardown(() => Helper.teardownStream(staging))

  stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 6, 'should stage 6 more files')
  ok(stagingFiles.includes('/modules-test/dir2/prebuilds-example/file1.js'))
  ok(stagingFiles.includes('/modules-test/dir2/prebuilds-example/file2.js'))
  ok(stagingFiles.includes('/modules-test/dir3/prebuilds-example/file1.js'))
  ok(stagingFiles.includes('/modules-test/dir3/prebuilds-example/file2.js'))
  ok(stagingFiles.includes('/modules-test/dir4/subdir/prebuilds-example/file1.js'))
  ok(stagingFiles.includes('/modules-test/dir4/subdir/prebuilds-example/file2.js'))
})

test('pear stage with purge', async function ({ ok, is, comment, teardown }) {
  const dir = Helper.fixture('app-with-subdir')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('normal stage')
  const stageLink = await Helper.touchLink(helper)

  let staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
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
  ok(stagingFiles.includes('/package.json'), 'package.json should exist')
  ok(stagingFiles.includes('/index.js'), 'index.js should exist')
  ok(stagingFiles.includes('/purge-file.js'), 'purge-file.js should exist')
  ok(
    stagingFiles.includes('/purge-dir1/purge-dir1-file.js'),
    'purge-dir1/purge-dir1-file.js should exist'
  )
  ok(
    stagingFiles.includes('/purge-dir1/purge-subdir/purge-subdir-file.js'),
    'purge-dir1/purge-subdir/purge-subdir-file.js should exist'
  )
  ok(
    stagingFiles.includes('/purge-dir2/purge-dir2-file.js'),
    'purge-dir2/purge-dir2-file.js should exist'
  )

  comment('check dry-run purge doesnt purge')
  staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: true,
    ignore: 'purge-file.js,purge-dir1,purge-dir2',
    purge: true
  })
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

  comment("check ignore doesn't purge")
  staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    ignore: 'purge-file.js,purge-dir1,purge-dir2',
    purge: false
  })
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
  const dumpDir = await tmp()

  let dump = await helper.dump({ link, dir: dumpDir, force: true })
  teardown(() => Helper.teardownStream(dump))

  let untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete
  const dumped = new Localdrive(dumpDir)
  ok(await dumped.exists('/package.json'), 'package.json should exist')
  ok(await dumped.exists('/index.js'), 'index.js should exist')
  ok(await dumped.exists('/purge-file.js'), 'purge-file.js should exist')
  ok(
    await dumped.exists('/purge-dir1/purge-dir1-file.js'),
    'purge-dir1/purge-dir1-file.js should exist'
  )
  ok(
    await dumped.exists('/purge-dir1/purge-subdir/purge-subdir-file.js'),
    'purge-dir1/purge-subdir/purge-subdir-file.js should exist'
  )
  ok(
    await dumped.exists('/purge-dir2/purge-dir2-file.js'),
    'purge-dir2/purge-dir2-file.js should exist'
  )

  comment('purge')
  staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    ignore: 'purge-file.js,purge-dir1,purge-dir2',
    purge: true
  })
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
  ok(
    removedFiles.includes('/purge-dir1/purge-dir1-file.js'),
    'purge-dir1/purge-dir1-file.js should be purged'
  )
  ok(
    removedFiles.includes('/purge-dir1/purge-subdir/purge-subdir-file.js'),
    'purge-dir1/purge-subdir/purge-subdir-file.js should be purged'
  )
  ok(
    removedFiles.includes('/purge-dir2/purge-dir2-file.js'),
    'purge-dir2/purge-dir2-file.js should be purged'
  )

  comment('check dump after purge')
  dump = await helper.dump({ link, dir: dumpDir, force: true })
  teardown(() => Helper.teardownStream(dump))
  untilDump = await Helper.pick(dump, [{ tag: 'complete' }])
  await untilDump.complete

  ok(await dumped.exists('/package.json'), 'package.json should exist')
  ok(await dumped.exists('/index.js'), 'index.js should exist')
  ok(!(await dumped.exists('/purge-file.js')), 'purge-file.js should NOT exist')
  ok(
    !(await dumped.exists('/purge-dir1/purge-dir1-file.js')),
    'purge-dir1/purge-dir1-file.js should NOT exist'
  )
  ok(
    !(await dumped.exists('purge-dir1/purge-subdir/purge-subdir-file.js')),
    'purge-dir1/purge-subdir/purge-subdir-file.js should NOT exist'
  )
  ok(
    !(await dumped.exists('/purge-dir2/purge-dir2-file.js')),
    'purge-dir2/purge-dir2-file.js should NOT exist'
  )
})

test('pear stage with purge config', async function ({ ok, is, comment, teardown }) {
  const dir = Helper.fixture('app-with-purge')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('normal stage')
  const stageLink = await Helper.touchLink(helper)

  let staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
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
  ok(stagingFiles.includes('/package.json'), 'package.json should exist')
  ok(stagingFiles.includes('/index.js'), 'index.js should exist')
  ok(stagingFiles.includes('/not-purged.js'), 'not-purged.js should exist')
  ok(stagingFiles.includes('/config-purge-file.js'), 'config-purge-file.js should exist')

  comment('purge')
  staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false,
    ignore: 'ignored-from-start.js,config-purge-file.js'
  })
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

test('pear stage warmup with entrypoints', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(4)

  const dir = Helper.fixture('warmup')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warmed' }, { tag: 'final' }])
  const warmed = await staged.warmed
  ok((await staged.final).success, 'stage succeeded')

  ok(warmed.blocks > 0, 'Warmup contains some blocks')
  ok(warmed.total > 0, 'Warmup total is correct')
  is(warmed.success, true, 'Warmup completed')
})

test('pear stage warmup with prefetch', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(4)

  const dir = Helper.fixture('warmup-with-prefetch')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link: stageLink,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warmed' }, { tag: 'final' }])
  const warmed = await staged.warmed
  ok((await staged.final).success, 'stage succeeded')

  ok(warmed.blocks > 0, 'Warmup contains some blocks')
  ok(warmed.total > 0, 'Warmup total is correct')
  is(warmed.success, true, 'Warmup completed')
})

test('pear stage double stage reported versions', async ({ teardown, comment, ok, is }) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const stageLink = await Helper.touchLink(helper)

  const from = new Localdrive(Helper.fixture('versions'))
  const to = new Localdrive(tmpdir)

  const mirror = from.mirror(to)
  await mirror.done()

  const makeIndex = (version) => `const pipe = require('pear-pipe')()
  Pear.versions().then((versions) => {
    pipe.write(JSON.stringify({ version: '${version}', ...versions }) + '\\n')
  })
`
  await to.put('/index.js', makeIndex('A'))

  comment('staging A')
  const stagingA = helper.stage({
    link: stageLink,
    dir: tmpdir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(stagingA))
  const stagedA = await Helper.pick(stagingA, [{ tag: 'addendum' }, { tag: 'final' }])
  const addendumA = await stagedA.addendum
  const lengthA = addendumA.version
  await stagedA.final

  const link = `pear://${addendumA.key}`

  const runA = await Helper.run({ link })
  const resultA = await Helper.untilResult(runA.pipe)
  const infoA = JSON.parse(resultA)
  await Helper.untilClose(runA.pipe)
  is(infoA.version, 'A')

  comment('staging B')
  await to.put('/index.js', makeIndex('B'))
  const stagingB = helper.stage({
    link,
    dir: tmpdir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(stagingB))
  const stagedB = await Helper.pick(stagingB, [{ tag: 'addendum' }, { tag: 'final' }])
  const addendumB = await stagedB.addendum
  const lengthB = addendumB.version
  await stagedB.final

  ok(lengthA < lengthB)

  // runAA Needed for update
  const runAA = await Helper.run({ link })
  await Helper.untilResult(runAA.pipe)
  await Helper.untilClose(runAA.pipe)

  const runB = await Helper.run({ link })
  const resultB = await Helper.untilResult(runB.pipe)
  const infoB = JSON.parse(resultB)
  await Helper.untilClose(runB.pipe)
  is(infoB.version, 'B')

  const run = await Helper.run({ link: `pear://0.${lengthA}.${addendumA.key}` })
  const result = await Helper.untilResult(run.pipe)
  const info = JSON.parse(result)
  await Helper.untilClose(run.pipe)

  is(info.version, 'A')
  is(info.app.length, lengthA)
})
