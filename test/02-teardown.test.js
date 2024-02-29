'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('teardown', async function ({ teardown, is, plan, comment }) {
  plan(2)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const key = global.testAppKey

  comment('running')
  const { inspector, pick, app } = await helper.launch(key, { tags: ['teardown', 'exit'] })

  await inspector.evaluate(
    `(() => {
        const { teardown } = Pear;
        teardown(() => console.log('teardown'));
    })()`)

  app.kill('SIGTERM')

  const td = await pick.teardown
  is(td, 'teardown', 'teardown has been triggered')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 130, 'exit code is 130')
})

test('teardown during teardown', async function ({ teardown, is, plan, comment }) {
  plan(2)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const key = global.testAppKey

  comment('running')
  const { inspector, pick, app } = await helper.launch(key, { tags: ['teardown', 'exit'] })

  await inspector.evaluate(
    `(() => {
        const { teardown } = Pear
        const a = () => { b() }
        const b = () => { teardown(() => console.log('teardown from b')) }
        teardown( () => a() )
    })()`)

  app.kill('SIGTERM')

  const td = await pick.teardown
  is(td, 'teardown from b', 'teardown from b has been triggered')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 130, 'exit code is 130')
})
