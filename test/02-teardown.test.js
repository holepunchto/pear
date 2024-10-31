'use strict'
const test = require('brittle')
const path = require('bare-path')
const { Helper, WorkerHelper } = require('./helper')
const workerWithTeardown = path.join(Helper.localDir, 'test', 'fixtures', 'worker-with-teardown')

test.solo('teardown', async function ({ is, ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const promiseId = 'teardown-executed'

  const worker = new WorkerHelper([promiseId])
  await worker.run({ dir: workerWithTeardown, ok, comment, teardown })

  const td = await worker.writeAndWait('teardown')
  is(td.value, 'teardown registered', 'teardown has been registered')
  
  await new Promise(resolve => setTimeout(resolve, 2000))
  worker.write('exit')

  const res = await worker.awaitPromise(promiseId)
  is(res,value, 'teardown executed', 'teardown has been executed')
})

test('teardown during teardown', async function ({ is, ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const worker = new WorkerHelper()
  const { key } = await worker.run({ dir: workerWithTeardown, ok, comment, teardown })

  await running.inspector.evaluate(
    `(() => {
        const { teardown } = Pear
        const a = () => { b() }
        const b = () => { teardown(() => console.log('teardown from b')) }
        teardown( () => a() )
    })()`)

  await running.inspector.evaluate('Pear.shutdown()')

  const td = await running.until.teardown
  is(td, 'teardown from b', 'teardown from b has been triggered')

  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

// TODO: fixme
test.skip('exit with non-zero code in teardown', async function ({ is, ok, plan, comment, teardown }) {
  plan(4)

  const worker = new WorkerHelper()
  const { key } = await worker.run({ dir: workerWithTeardown, ok, comment, teardown })

  await running.inspector.evaluate('Pear.teardown(() => Pear.exit(124))')

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  // running.subprocess.kill('SIGINT') <-- this was forcing the exit code, which false-positives the test

  const { code } = await running.until.exit
  is(code, 124, 'exit code is 124')
})
