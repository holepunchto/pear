'use strict'
/* global Pear */
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const worker = path.join(Helper.localDir, 'test', 'fixtures', 'worker')
const helloWorld = path.join(Helper.localDir, 'test', 'fixtures', 'hello-world')
const printArgs = path.join(Helper.localDir, 'test', 'fixtures', 'print-args')
const workerRunner = path.join(Helper.localDir, 'test', 'fixtures', 'worker-runner')

const workerParent = path.join(Helper.localDir, 'test', 'fixtures', 'worker-parent')
const workerChild = path.join(Helper.localDir, 'test', 'fixtures', 'worker-child')
const workerEndFromChild = path.join(Helper.localDir, 'test', 'fixtures', 'worker-end-from-child')
const workerDestroyFromChild = path.join(Helper.localDir, 'test', 'fixtures', 'worker-destroy-from-child')
const workerEndFromParent = path.join(Helper.localDir, 'test', 'fixtures', 'worker-end-from-parent')
const workerDestroyFromParent = path.join(Helper.localDir, 'test', 'fixtures', 'worker-destroy-from-parent')
const workerParentErrorHandler = path.join(Helper.localDir, 'test', 'fixtures', 'worker-parent-error-handler')
const workerChildErrorHandler = path.join(Helper.localDir, 'test', 'fixtures', 'worker-child-error-handler')
const workerFromSameBundle = path.join(Helper.localDir, 'test', 'fixtures', 'worker-from-same-bundle')
const workerExceptionHandler = path.join(Helper.localDir, 'test', 'fixtures', 'worker-exception-handler')

test('worker pipe', async function ({ is, plan, teardown }) {
  plan(1)
  const helper = new Helper()
  teardown(() => helper.close())
  await helper.ready()
  const dir = worker

  const pipe = Pear.worker.run(dir)
  pipe.on('error', (err) => {
    if (err.code === 'ENOTCONN') return
    throw err
  })

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

test('worker should receive args from the parent', async function ({ is, plan }) {
  plan(1)

  const args = ['hello', 'world']
  const { pipe } = await Helper.run({ link: printArgs, args })
  const result = await Helper.untilResult(pipe)

  is(result, JSON.stringify(args), 'worker should receive args from the parent')

  await Helper.untilClose(pipe)
})

test('worker should run directly in a terminal app', async function ({ is, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const testId = Math.floor(Math.random() * 100000)
  comment('Staging worker-runner...')
  const staging = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: workerRunner, cmdArgs: [], dryRun: false, ignore: [] })
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { link } = await until.staging
  await until.final

  comment('Running worker using worker-runner...')
  const { pipe } = await Helper.run({ link, args: [helloWorld] })
  const response = await Helper.untilResult(pipe)

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
  const staging1 = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: workerRunner, cmdArgs: [], dryRun: false, ignore: [] })
  teardown(() => Helper.teardownStream(staging1))
  const until1 = await Helper.pick(staging1, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: runnerLink } = await until1.staging
  await until1.final

  comment('Staging worker...')
  const staging2 = helper.stage({ channel: `test-worker-${testId}`, name: `test-worker-${testId}`, key: null, dir: helloWorld, cmdArgs: [], dryRun: false, ignore: [] })
  teardown(() => Helper.teardownStream(staging2))
  const until2 = await Helper.pick(staging2, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: workerLink } = await until2.staging
  await until2.final

  comment('Running worker using worker-runner...')
  const { pipe } = await Helper.run({ link: runnerLink, args: [workerLink] })
  const response = await Helper.untilResult(pipe)

  is(response, 'hello world', 'worker should send expected response')

  await Helper.untilClose(pipe)
})

//
// test worker exit gracefully for terminal app
//

test('worker exit when child calls pipe.end()', async function () {
  const pipe = await Pear.worker.run(workerParent, [workerEndFromChild])
  const pid = await Helper.untilResult(pipe)
  await Helper.untilWorkerExit(pid)
})

test('worker exit when child calls pipe.destroy()', async function () {
  const pipe = await Pear.worker.run(workerParentErrorHandler, [workerDestroyFromChild])
  const pid = await Helper.untilResult(pipe)
  await Helper.untilWorkerExit(pid)
})

test('worker exit when parent calls pipe.end()', async function () {
  const pipe = await Pear.worker.run(workerEndFromParent, [workerChild])
  const pid = await Helper.untilResult(pipe)
  await Helper.untilWorkerExit(pid)
})

test('worker exit when parent calls pipe.destroy()', async function () {
  const pipe = await Pear.worker.run(workerDestroyFromParent, [workerChildErrorHandler])
  const pid = await Helper.untilResult(pipe)
  await Helper.untilWorkerExit(pid)
})

test('worker in desktop app', async function ({ is, teardown }) {
  const dir = workerFromSameBundle
  const entrypoint = '/worker/index.js'

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}/worker/index.js`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  const info = JSON.parse(result)

  is(info.entrypoint, entrypoint, 'path entrypoint should work with app key')
  await Helper.untilClose(run.pipe)

  const fileLink = path.join(dir, 'worker', 'index.js')
  const fileRun = await Helper.run({ link: fileLink })

  const fileResult = await Helper.untilResult(fileRun.pipe)
  const fileInfo = JSON.parse(fileResult)

  is(fileInfo.entrypoint, entrypoint, 'path entrypoint should work with local app')
  await Helper.untilClose(fileRun.pipe)
})

test('worker can set uncaughtException handler', async function ({ is, teardown }) {
  const dir = workerExceptionHandler
  const expected = 'HANDLED-ERROR'

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const run = await Helper.run({ link: dir })
  const result = await Helper.untilResult(run.pipe)

  is(result, expected, 'uncaughtException handler in worker works')
  await Helper.untilClose(run.pipe)
})
