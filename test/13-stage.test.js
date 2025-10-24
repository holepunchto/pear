'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const stageAppMin = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'stage-app-min'
)
const stageAppMinWithOnly = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'stage-app-min-with-only'
)
const stageAppMinWithEntrypoints = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'stage-app-min-with-entrypoints'
)
const stagePearMain = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'stage-pear-main'
)

test('basic stage min desktop app', async ({ teardown, ok, is, comment }) => {
  const dir = stageAppMin

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
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

  const staged = await Helper.pick(staging, [
    { tag: 'warmed' },
    { tag: 'final' }
  ])
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

test('basic stage min desktop app with entrypoints', async ({
  teardown,
  ok,
  is,
  comment
}) => {
  const dir = stageAppMinWithEntrypoints

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
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

  const staged = await Helper.pick(staging, [
    { tag: 'warmed' },
    { tag: 'final' }
  ])
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

test('basic stage min desktop app with only and include', async ({
  teardown,
  ok,
  is,
  comment
}) => {
  const dir = stageAppMinWithOnly

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
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

  const staged = await Helper.pick(staging, [
    { tag: 'warmed' },
    { tag: 'final' }
  ])
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
    '/node_modules/ready-resource/index.js'
  ]

  comment('Only files in the dependency tree and pear.stage.only are staged')
  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})

test.skip('stage pear.main file', async ({ teardown, ok, comment }) => {
  const dir = stagePearMain

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
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

  console.log(expectedStagedFiles)

  comment('Only files in the dependency tree are staged')
  ok(stagedFiles.length === expectedStagedFiles.length)
  ok(stagedFiles.every((e) => expectedStagedFiles.includes(e)))
})
