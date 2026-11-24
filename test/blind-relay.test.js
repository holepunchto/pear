'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const DHT = require('hyperdht')
const FramedStream = require('framed-stream')
const b4a = require('b4a')
const { Client, token } = require('blind-relay')
const Helper = require('./helper')

let recordedPublicKey

test('pear blind-relay start basic', async function ({ ok, is, plan, teardown, timeout }) {
  timeout(180000)
  plan(14)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const blindRelay = helper.blindRelay({ action: 'start' })
  teardown(() => Helper.teardownStream(blindRelay))
  const until = await Helper.pick(blindRelay, [{ tag: 'listening' }, { tag: 'stats' }])

  const { publicKey } = await until.listening
  is(publicKey, hypercoreid.normalize(publicKey), 'publicKey is z32')
  recordedPublicKey = publicKey

  const { stats } = await until.stats

  ok(Number.isInteger(stats.sessions.accepted), 'stats have accepted sessions')
  ok(Number.isInteger(stats.sessions.opened), 'stats have opened sessions')
  ok(Number.isInteger(stats.sessions.closed), 'stats have closed sessions')
  ok(Number.isInteger(stats.sessions.active), 'stats have active sessions')

  ok(Number.isInteger(stats.pairings.requested), 'stats have requested pairings')
  ok(Number.isInteger(stats.pairings.matched), 'stats have matched pairings')
  ok(Number.isInteger(stats.pairings.cancelled), 'stats have cancelled pairings')
  ok(Number.isInteger(stats.pairings.pending), 'stats have pending pairings')
  ok(Number.isInteger(stats.pairings.active), 'stats have active pairings')

  ok(Number.isInteger(stats.streams.opened), 'stats have opened streams')
  ok(Number.isInteger(stats.streams.closed), 'stats have closed streams')
  ok(Number.isInteger(stats.streams.errors), 'stats have errors streams')
  ok(Number.isInteger(stats.streams.active), 'stats have active streams')
})

test('pear blind-relay restart must have same public key', async function ({
  is,
  plan,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const blindRelay = helper.blindRelay({ action: 'start' })
  teardown(() => Helper.teardownStream(blindRelay))
  const until = await Helper.pick(blindRelay, [{ tag: 'listening' }])

  const { publicKey } = await until.listening
  is(publicKey, recordedPublicKey)
})

test('pear blind-relay start should not start twice', async function ({
  teardown,
  plan,
  exception
}) {
  plan(1)

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  {
    const serverStream = server.blindRelay({ action: 'start' })
    teardown(() => Helper.teardownStream(serverStream))
    const serverMsgs = await Helper.pick(serverStream, [{ tag: 'listening' }])
    await serverMsgs.listening
  }

  {
    const serverStream = server.blindRelay({ action: 'start' })
    teardown(() => Helper.teardownStream(serverStream))
    const serverMsgs = await Helper.pick(serverStream, [{ tag: 'listening' }])
    await exception(
      serverMsgs.listening,
      /Blind relay is already running/,
      'Should fail to start blind-relay when it is already running'
    )
  }
})

test('pear blind-relay start should restart after stopping previous instance', async function ({
  teardown,
  plan,
  ok
}) {
  plan(2)

  {
    const server = new Helper()
    teardown(() => server.close(), { order: Infinity })
    await server.ready()

    const serverStream = server.blindRelay({ action: 'start' })
    serverStream.on('error', () => {})
    teardown(() => Helper.teardownStream(serverStream))
    const { listening } = await Helper.pick(serverStream, [{ tag: 'listening' }])
    ok((await listening).publicKey, 'first blind-relay started')

    await Helper.teardownStream(serverStream)
    await server.close()
  }

  {
    const server = new Helper()
    teardown(() => server.close(), { order: Infinity })
    await server.ready()

    const serverStream = server.blindRelay({ action: 'start' })
    serverStream.on('error', () => {})
    teardown(() => Helper.teardownStream(serverStream))
    const { listening } = await Helper.pick(serverStream, [{ tag: 'listening' }])
    ok((await listening).publicKey, 'second blind-relay started after previous closed')
  }
})

test('pear blind-relay keeps relaying after a relayed stream errors', async function ({
  ok,
  plan,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(4)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const relayStream = helper.blindRelay({ action: 'start', statsInterval: 100 })
  teardown(() => Helper.teardownStream(relayStream))
  const { listening } = await Helper.pick(relayStream, [{ tag: 'listening' }])
  const relayKey = hypercoreid.decode((await listening).publicKey)

  const a = new DHT({ bootstrap: Helper.dhtBootstrap })
  const b = new DHT({ bootstrap: Helper.dhtBootstrap })
  teardown(() => Promise.all([a.destroy(), b.destroy()]))

  const first = await relayedPair(a, b, relayKey)
  await exchange(first)
  ok(true, 'data relayed between the first pair')

  // destroying one end resets the relay's stream (ECONNRESET on the relay side)
  first.initiator.raw.destroy()
  const stats = await untilStats(relayStream, (stats) => stats.streams.errors > 0)
  ok(stats.streams.errors > 0, 'relay recorded the stream error')

  const second = await relayedPair(a, b, relayKey)
  await exchange(second)
  ok(true, 'data relayed between a new pair after the error')
  ok(relayStream.destroyed === false, 'blind-relay operation is still running')
})

async function relayedPair(a, b, relayKey) {
  const pairingToken = token()
  const [initiator, responder] = await Promise.all([
    pairThroughRelay(a, relayKey, true, pairingToken),
    pairThroughRelay(b, relayKey, false, pairingToken)
  ])
  return { initiator, responder }
}

async function pairThroughRelay(dht, relayKey, isInitiator, pairingToken) {
  const socket = dht.connect(relayKey)
  socket.on('error', noop)
  await new Promise((resolve, reject) => socket.once('open', resolve).once('close', reject))

  const raw = dht.createRawStream({ framed: true })
  raw.on('error', noop)
  const client = Client.from(socket, { id: socket.publicKey })
  const remoteId = await new Promise((resolve, reject) => {
    client.pair(isInitiator, pairingToken, raw).on('data', resolve).on('error', reject)
  })
  const { remotePort, remoteHost, socket: udp } = socket.rawStream
  raw.connect(udp, remoteId, remotePort, remoteHost)
  const stream = new FramedStream(raw, { bits: 24 })
  stream.on('error', noop)
  return { socket, raw, stream }
}

// both ends send, so the relay connects both of its streams
async function exchange({ initiator, responder }) {
  const received = Promise.all([
    receive(responder.stream, 'ping'),
    receive(initiator.stream, 'pong')
  ])
  initiator.stream.write('ping')
  responder.stream.write('pong')
  await received
}

function receive(stream, text) {
  return new Promise((resolve, reject) => {
    let data = ''
    const timer = setTimeout(() => reject(new Error(`"${text}" was not relayed`)), 30000)
    stream.on('data', (chunk) => {
      data += b4a.toString(chunk)
      if (data.includes(text)) {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

// rejects as soon as the operation errors or closes, e.g. when the sidecar crashes
function untilStats(stream, predicate) {
  return new Promise((resolve, reject) => {
    const ondata = (message) => {
      if (message?.tag === 'error') return onerror(new Error(message.data?.message))
      if (message?.tag === 'stats' && predicate(message.data.stats)) done(null, message.data.stats)
    }
    const onerror = (err) => done(new Error(`blind-relay operation failed: ${err.message}`))
    const onclose = () => done(new Error('blind-relay operation closed'))
    const done = (err, stats) => {
      stream.off('data', ondata)
      stream.off('error', onerror)
      stream.off('close', onclose)
      if (err) reject(err)
      else resolve(stats)
    }
    stream.on('data', ondata)
    stream.on('error', onerror)
    stream.on('close', onclose)
  })
}

function noop() {}
