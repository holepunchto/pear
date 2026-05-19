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
      if (session) session.destroy()
    },
    { order: Infinity }
  )

  const key = await helper.inspect()
  ok(key, 'inspect returns sidecar inspect key')
  alike(key, await helper.inspect(), 'sidecar returns same inspect key')
  const { result } = await inspectWithRetry(
    () => new Session({ inspectorKey: key, bootstrap: Helper.dhtBootstrap }),
    (s) => {
      session = s
    }
  )
  ok(result, 'sidecar is defined')
})

async function inspectWithRetry(createSession, setSession, maxAttempts = 4) {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = createSession()
    setSession(session)
    try {
      await waitForInfo(session)
      session.connect()
      const id = attempt
      const response = waitForMessageById(session, id, 30000)
      session.post({
        id,
        method: 'Runtime.evaluate',
        params: { expression: 'global.sidecar' }
      })
      const msg = await response
      return msg
    } catch (err) {
      lastErr = err
      try {
        await session.destroy()
      } catch {}
      if (attempt < maxAttempts) await wait(250 * attempt)
    }
  }
  throw lastErr || new Error('inspector retry failed')
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
