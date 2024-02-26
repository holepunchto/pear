'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const { Session } = require('pear-inspect')
const { Readable } = require('streamx')

test('smoke', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(4)
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
  const app = await helper.pick(helper.run({ args: [key], dev: true, key, dir }), { tag: 'child' })

  const iterable = new Readable({ objectMode: true })

  app.once('exit', (code, signal) => {
    iterable.push({ tag: 'exit', data: { code, signal } })
  })

  app.stdout.on('data', (data) => {
    const str = data.toString()
    if (str.indexOf('key') > -1) {
      const match = str.match(/\[ inspect \] key: ([a-f0-9]+)\n/)
      if (match) iterable.push({ tag: 'inspectkey', data: match[1] })
    }
  })
  app.stderr.on('data', (data) => {
    const err = data.toString()
    console.error(err)
    iterable.push({ tag: 'stderr', data })
  })

  const tag = helper.pickMany(iterable, [{ tag: 'inspectkey' }, { tag: 'teardown' }, { tag: 'exit' }])

  const ik = await tag.inspectkey
  const session = new Session({ inspectorKey: Buffer.from(ik, 'hex') })

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
          const { versions } = Pear;
          return await versions();
        })()`,
      awaitPromise: true,
      returnByValue: true
    }
  })

  session.on('message', async ({ id, result, error }) => {
    if (error) console.error(error)

    const { result: { value } } = result

    if (value !== 'exit') {
      is(value.app.key, key, 'app version matches staged key')

      session.post({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            global.inspector.disable();
            return 'exit';
        })()`
        }
      })
    }

    if (value === 'exit') {
      await helper.closeClients()
      await helper.shutdown()

      session.disconnect()
      await session.destroy()

      const { code } = await tag.exit
      is(code, 0, 'exit code is 0')
    }
  })
})
