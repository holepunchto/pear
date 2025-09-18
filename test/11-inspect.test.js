'use strict'
const test = require('brittle')
const Helper = require('./helper')
const { Session } = require('pear-inspect')

test('inspect', async function ({ ok, teardown, alike, plan }) {
  plan(3)
  const helper = new Helper()
  await helper.ready()
  let session = null

  teardown(
    () => {
      helper.close()
      session.destroy()
    },
    { order: Infinity }
  )

  const key = await helper.inspect()
  session = new Session({ inspectorKey: key, bootstrap: null })
  ok(key, 'inspect returns sidecar inspect key')
  alike(key, await helper.inspect(), 'sidecar returns same inspect key')
  session.connect()
  session.on('message', ({ result }) => {
    ok(result, 'sidecar is defined')
  })

  session.post({
    method: 'Runtime.evaluate',
    params: { expression: 'global.sidecar' }
  })
})
