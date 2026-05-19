'use strict'
const test = require('brittle')
const Helper = require('./helper')
const { Session } = require('pear-inspect')

test('inspect', async function ({ ok, teardown, alike, plan, timeout }) {
  plan(3)
  timeout(120000)
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
  session = new Session({ inspectorKey: key, bootstrap: Helper.dhtBootstrap })
  ok(key, 'inspect returns sidecar inspect key')
  alike(key, await helper.inspect(), 'sidecar returns same inspect key')

  await waitForInfo(session)
  session.connect()

  const id = 1
  const response = waitForMessageById(session, id, 30000)
  session.post({
    id,
    method: 'Runtime.evaluate',
    params: { expression: 'global.sidecar' }
  })

  const { result } = await response
  ok(result, 'sidecar is defined')
})

function waitForInfo(session, ms = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('inspector info timeout'))
    }, ms)

    const onInfo = () => {
      cleanup()
      resolve()
    }
    const onClose = () => {
      cleanup()
      reject(new Error('inspector closed before handshake'))
    }
    const cleanup = () => {
      clearTimeout(timer)
      session.off('info', onInfo)
      session.off('close', onClose)
    }

    session.on('info', onInfo)
    session.on('close', onClose)
  })
}

function waitForMessageById(session, id, ms = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('inspector response timeout'))
    }, ms)

    const onMessage = (msg) => {
      if (!msg || msg.id !== id) return
      cleanup()
      if (msg.error) reject(msg.error)
      else resolve(msg)
    }
    const onClose = () => {
      cleanup()
      reject(new Error('inspector closed before response'))
    }
    const cleanup = () => {
      clearTimeout(timer)
      session.off('message', onMessage)
      session.off('close', onClose)
    }

    session.on('message', onMessage)
    session.on('close', onClose)
  })
}
