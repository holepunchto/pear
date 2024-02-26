'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const { Session } = require('pear-inspect')

test('teardown', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(3)
  timeout(30000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = helper.pickMany(helper.run({ args: [key], dev: true, key, dir }), [{ tag: 'ready' }, { tag: 'inspectkey' }, { tag: 'teardown' }, { tag: 'exit' }])

  await app.ready

  const ik = await app.inspectkey
  const session = new Session({ inspectorKey: Buffer.from(ik, 'hex') })

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
          const { teardown } = Pear;
          teardown(async () => console.log('[ inspect ] teardown'));
        })()`,
      awaitPromise: true,
      returnByValue: true
    }
  })

  session.once('message', async ({ id, result, error }) => {
    if (error) console.error(error)

    await helper.closeClients()
    await helper.shutdown()

    helper.closeApp('SIGTERM')

    await app.teardown

    session.disconnect()
    await session.destroy()

    const { code } = await app.exit
    is(code, 130, 'exit code is 130')
  })
})
