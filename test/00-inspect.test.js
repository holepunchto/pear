'use strict'
const test = require('brittle')
const Helper = require('./helper')
const { Session } = require('pear-inspect')
const env = require('bare-env')

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
  ok(key, 'inspect returns sidecar inspect key')
  alike(key, await helper.inspect(), 'sidecar returns same inspect key')
  const timeoutMs = env.CI ? 20_000 : 5_000
  session = new Session({ inspectorKey: key, bootstrap: Helper.dhtBootstrap })
  const hasSidecar = await evaluateOnce(session, timeoutMs)

  ok(hasSidecar, 'sidecar is defined')
})

async function evaluateOnce(session, timeoutMs) {
  const waitInfo = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('inspector info timeout')), timeoutMs)
    session.once('info', () => {
      clearTimeout(timeout)
      resolve()
    })
    session.once('close', () => {
      clearTimeout(timeout)
      reject(new Error('inspector closed before handshake'))
    })
  })

  // Listener must be attached before connect() to avoid missing fast handshake.
  session.connect()
  await waitInfo

  return await new Promise((resolve, reject) => {
    const id = 1
    const timeout = setTimeout(() => reject(new Error('inspector response timeout')), timeoutMs)
    const onMessage = ({ id: msgId, result, error }) => {
      if (msgId !== id) return
      clearTimeout(timeout)
      session.off('message', onMessage)
      if (error) return reject(new Error(error.message || 'inspector error'))
      resolve(result)
    }
    session.on('message', onMessage)
    session.once('close', () => {
      clearTimeout(timeout)
      session.off('message', onMessage)
      reject(new Error('inspector closed before response'))
    })
    session.post({
      id,
      method: 'Runtime.evaluate',
      params: { expression: 'global.sidecar' }
    })
  })
}
