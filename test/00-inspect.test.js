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
      if (session) session.destroy()
    },
    { order: Infinity }
  )

  const key = await helper.inspect()
  session = new Session({ inspectorKey: key, bootstrap: Helper.dhtBootstrap })
  ok(key, 'inspect returns sidecar inspect key')
  alike(key, await helper.inspect(), 'sidecar returns same inspect key')
  session.connect()

  const hasSidecar = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('inspector response timeout')), 5000)
    session.once('message', ({ result, error }) => {
      clearTimeout(timeout)
      if (error) return reject(new Error(error.message || 'inspector error'))
      resolve(result)
    })
    session.post({
      method: 'Runtime.evaluate',
      params: { expression: 'global.sidecar' }
    })
  })

  ok(await hasSidecar, 'sidecar is defined')
})
