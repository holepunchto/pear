'use strict'
/* global Pear */
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const worker = path.join(Helper.localDir, 'test', 'fixtures', 'worker')
const harness = path.join(Helper.localDir, 'test', 'fixtures', 'harness')

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
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const testId = Math.floor(Math.random() * 100000)
  comment('Staging harness...')
  const staging = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: harness, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { link } = await until.staging
  await until.final

  const running = await Helper.open(link, { tags: ['exit'] })

  comment('Running worker...')
  const response = await running.inspector.evaluate(`
    (async function runWorker() {
        const pipe = Pear.worker.run(${JSON.stringify(worker)})
        __PEAR_TEST__.workerPipe = pipe
        const messages = []
        const response = new Promise((resolve) => {
          pipe.on('data', (data) => {
            messages.push(data.toString())
            if (messages.length === 4) resolve(messages.join(''))
          })
        })

        pipe.write('ping')

        return response
      }
    )()
  `, { awaitPromise: true })

  is(response.value, '0123', 'worker in terminal should receive expected response')

  await running.inspector.evaluate('__PEAR_TEST__.workerPipe.write("exit")')
  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('worker should run as a link in a terminal app', async function ({ is, plan, comment, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const testId = Math.floor(Math.random() * 100000)
  comment('Staging harness...')
  const staging1 = helper.stage({ channel: `test-${testId}`, name: `test-${testId}`, key: null, dir: harness, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  const until1 = await Helper.pick(staging1, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: harnessLink } = await until1.staging
  await until1.final

  comment('Staging worker...')
  const staging2 = helper.stage({ channel: `test-worker-${testId}`, name: `test-worker-${testId}`, key: null, dir: worker, cmdArgs: [], dryRun: false, bare: true, ignore: [] })
  const until2 = await Helper.pick(staging2, [{ tag: 'staging' }, { tag: 'final' }])
  const { link: workerLink } = await until2.staging
  await until2.final

  const running = await Helper.open(harnessLink, { tags: ['exit'] })
  comment('Running worker...')
  const response = await running.inspector.evaluate(`
    (async function runWorker() {
        const pipe = Pear.worker.run(${JSON.stringify(workerLink)})
        __PEAR_TEST__.workerPipe = pipe
        const messages = []
        const response = new Promise((resolve) => {
          pipe.on('data', (data) => {
            messages.push(data.toString())
            if (messages.length === 4) resolve(messages.join(''))
          })
        })

        pipe.write('ping')

        return response
      }
    )()
  `, { awaitPromise: true })

  is(response.value, '0123', 'worker in terminal should receive expected response')

  await running.inspector.evaluate('__PEAR_TEST__.workerPipe.write("exit")')
  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})
