'use strict'
/* global Pear */
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const worker = path.join(Helper.localDir, 'test', 'fixtures', 'worker')
const helloWorld = path.join(Helper.localDir, 'test', 'fixtures', 'hello-world')
const workerRunner = path.join(Helper.localDir, 'test', 'fixtures', 'worker-runner')

test('worker pipe', async function ({ is, plan, teardown }) {
  plan(1)
  const helper = new Helper()
  teardown(() => helper.close())
  await helper.ready()
  const dir = worker

  const pipe = Pear.worker.run(dir)

  const messages = []
  const response = new Promise((resolve) => {
    pipe.on('data', (data) => {
      messages.push(data.toString())
      if (messages.length === 4) resolve(messages.join(''))
    })
  })

  pipe.write('ping')

  const workerResponse = await response
  is(workerResponse, '0123', 'worker pipe can send and receive data')

  pipe.write('exit')
})

test('worker should run directly in a terminal app', async function ({ is, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const testId = Math.floor(Math.random() * 100000)
  comment('Staging worker-runner...')
  const staging = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: workerRunner, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { link } = await until.staging
  await until.final

  comment('Running worker using worker-runner...')
  const { pipe } = await Helper.run({ link })
  const response = await Helper.untilResult(pipe, helloWorld)

  is(response, 'hello world', 'worker should send expected response')

  await Helper.untilClose(pipe)
})

test('worker should run as a link in a terminal app', async function ({ is, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const testId = Math.floor(Math.random() * 100000)
  comment('Staging worker-runner...')
  const staging1 = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: workerRunner, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  teardown(() => Helper.teardownStream(staging1))
  const until1 = await Helper.pick(staging1, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: runnerLink } = await until1.staging
  await until1.final

  comment('Staging worker...')
  const staging2 = helper.stage({ channel: `test-worker-${testId}`, name: `test-worker-${testId}`, key: null, dir: helloWorld, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  teardown(() => Helper.teardownStream(staging2))
  const until2 = await Helper.pick(staging2, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: workerLink } = await until2.staging
  await until2.final

  comment('Running worker using worker-runner...')
  const { pipe } = await Helper.run({ link: runnerLink })
  const response = await Helper.untilResult(pipe, workerLink)

  is(response, 'hello world', 'worker should send expected response')

  await Helper.untilClose(pipe)
})
