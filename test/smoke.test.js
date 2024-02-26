'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const { Session } = require('pear-inspect')

test('smoke', async function({ teardown, ok, is, plan, timeout, comment }) {
  plan(3)
  timeout(180000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    clientArgv: []
  }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key],
    dev: true,
    key,
    dir
  }), [{ tag: 'ready' }, { tag: 'inspectorKey' }, { tag: 'exit' }])

  console.log('before app ready')
  await app.ready
  console.log('cool, app ready')

  const ik = await app.inspectorKey
  console.log('ik received:', ik)

  const session = new Session({ inspectorKey: Buffer.from(ik, 'hex') })

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
          const { teardown } = Pear;
          const stdout = global.stdout;
          stdout.write('--------------- testing stdout');
          teardown(() => stdout.write('----------- heyyy this is a message from teardown'));
        })()`,
      awaitPromise: true,
      returnByValue: true
    }
  })

  session.once('message', async ({ id, result, error }) => {
    console.log(result)
    if (error) console.error(error)

    await helper.closeClients()
    await helper.shutdown()

    session.disconnect()
    await session.destroy()

    const { code } = await app.exit
    is(code, 0, 'exit code is 0')

  })

})
