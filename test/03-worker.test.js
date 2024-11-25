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
const workerParentDesktop = path.join(Helper.localDir, 'test', 'fixtures', 'worker-parent-desktop')

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
  const staging = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: workerRunner, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
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
  const { pipe } = await Helper.run({ link: runnerLink, args: [workerLink] })
  const response = await Helper.untilResult(pipe)

  is(response, 'hello world', 'worker should send expected response')

  await Helper.untilClose(pipe)
})

//
// test worker exit gracefully for terminal app
//

test('[terminal] worker exit when child calls pipe.end()', async function () {
  const { pipe } = await Helper.run({ link: workerParent, args: [workerEndFromChild] })
  await Helper.untilClose(pipe)
})

test('[terminal] worker exit when child calls pipe.destroy()', async function () {
  const { pipe } = await Helper.run({ link: workerParent, args: [workerDestroyFromChild] })
  await Helper.untilClose(pipe)
})

test('[terminal] worker exit when parent calls pipe.end()', async function () {
  const { pipe } = await Helper.run({ link: workerEndFromParent, args: [workerChild] })
  await Helper.untilClose(pipe)
})

test('[terminal] worker exit when parent calls pipe.destroy()', async function () {
  const { pipe } = await Helper.run({ link: workerDestroyFromParent, args: [workerChild] })
  await Helper.untilClose(pipe)
})

//
// test worker exit gracefully for desktop app
//

test.skip('[desktop] worker exit when child calls pipe.end()', async function () {

})

test.skip('[desktop] worker exit when child calls pipe.destroy()', async function () {

})

test.skip('[desktop] worker exit when parent calls pipe.end()', async function () {

})

test.skip('[desktop] worker exit when parent calls pipe.destroy()', async function () {

})
