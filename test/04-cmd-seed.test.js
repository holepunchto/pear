'use strict'
const { once } = require('events')
const Hyperswarm = require('hyperswarm')
const Hypercore = require('hypercore')
const ram = require('random-access-memory')
const test = require('brittle')
const joyrider = require('joyrider')
const hypercoreid = require('hypercore-id-encoding')

const rider = joyrider(__filename)

test('seed staged channel', async ({ is, alike, ok, execution, plan, teardown }) => {
  plan(7)
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'seed-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')
  ok(seed.key)
  is(seed.seeding.name, 'seed-test')
  is(seed.seeding.channel, 'test')
  is(seed.seeding.key, null)
  alike(seed.phases.map(({ tag }) => tag), ['seeding', 'key', 'announced'])
  is(seed.connections.length, 0)
  const connection = once(seed, 'connection')
  const core = new Hypercore(ram, hypercoreid.decode(seed.key))
  const bootstrap = ride.testnet.nodes.flatMap((node) => node.bootstrapNodes)
  const swarm = new Hyperswarm({ bootstrap })

  teardown(async () => {
    await core.close()
    await swarm.clear()
    await swarm.destroy({ force: true })
  })
  await core.ready()

  swarm.on('connection', (connection) => core.replicate(connection))
  const connecting = once(swarm, 'connection')
  const discovery = await swarm.join(core.discoveryKey)

  await discovery.flushed()
  await swarm.flush()
  await connecting

  await execution(connection)
})

// test.skip('seed from staged key', async function ({ is, alike, ok, execution, plan, teardown }) {
//   plan(5)

//   const ride = await rider({
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'seed-test' }
//   })

//   await ride.stage('test')

//   const seed = await ride.seed('test')

//   const reseed = await ride.seed({ from: seed.key })

//   ok(reseed.key)
//   is(reseed.seeding.key, seed.key)
//   is(reseed.seeding.channel, 'test')
//   is(reseed.seeding.name, null)
//   alike(reseed.phases.map(({ tag }) => tag), ['seeding', 'key', 'announced'])
//   is(reseed.connections.length, 0)
//   const connection = once(reseed, 'connection')
//   const core = new Hypercore(ram, hypercoreid.decode(reseed.key))
//   const bootstrap = ride.testnet.nodes.flatMap((node) => node.bootstrapNodes)
//   const swarm = new Hyperswarm({ bootstrap })
//   teardown(async () => {
//     await core.close()
//     await swarm.clear()
//     await swarm.destroy({ force: true })
//   })
//   await core.ready()
//   swarm.on('connection', (connection) => core.replicate(connection))
//   const connecting = once(swarm, 'connection')
//   const discovery = await swarm.join(core.discoveryKey)
//   await discovery.flushed()
//   await swarm.flush()
//   await connecting
//   await execution(connection)
// })

// test('seed released channel,', async ({ is, alike, ok, execution, plan, teardown }) => {
//   plan(8)

//   const ride = await rider({
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'seed-test' }
//   })

//   await ride.stage('test')

//   await ride.release('test')

//   const seed = await ride.seed('test')

//   ok(seed.key)
//   is(seed.seeding.name, 'seed-test')
//   is(seed.seeding.channel, 'test')
//   is(seed.seeding.key, null)
//   alike(seed.phases.map(({ tag }) => tag), ['seeding', 'key', 'announced'])
//   is(seed.connections.length, 0)
//   const connection = once(seed, 'connection')
//   const core = new Hypercore(ram, hypercoreid.decode(seed.key))
//   const bootstrap = ride.testnet.nodes.flatMap((node) => node.bootstrapNodes)
//   const swarm = new Hyperswarm({ bootstrap })
//   teardown(async () => {
//     await core.close()
//     await swarm.clear()
//     await swarm.destroy({ force: true })
//   })
//   await core.ready()
//   swarm.on('connection', (connection) => core.replicate(connection))
//   const connecting = once(swarm, 'connection')
//   const discovery = await swarm.join(core.discoveryKey)
//   await discovery.flushed()
//   await swarm.flush()
//   await connecting
//   await execution(connection)
//   is(seed.connections.length, 1)
// })

// test.skip('seed from released key', async function ({ is, alike, ok, execution, plan, teardown }) {
//   plan(4)

//   const ride = await rider({
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'seed-test' }
//   })

//   await ride.stage('test')

//   await ride.release('test')

//   const seed = await ride.seed('test')

//   const reseed = await ride.seed({ from: seed.key })

//   ok(reseed.key)
//   is(reseed.seeding.key, seed.key)
//   is(reseed.seeding.channel, 'test')
//   is(reseed.seeding.name, null)
//   alike(reseed.phases.map(({ tag }) => tag), ['seeding', 'key', 'announced'])
//   is(reseed.connections.length, 0)
//   const connection = once(reseed, 'connection')
//   const core = new Hypercore(ram, hypercoreid.decode(reseed.key))
//   const bootstrap = ride.testnet.nodes.flatMap((node) => node.bootstrapNodes)
//   const swarm = new Hyperswarm({ bootstrap })
//   teardown(async () => {
//     await core.close()
//     await swarm.clear()
//     await swarm.destroy({ force: true })
//   })
//   await core.ready()
//   swarm.on('connection', (connection) => core.replicate(connection))
//   const connecting = once(swarm, 'connection')
//   const discovery = await swarm.join(core.discoveryKey)
//   await discovery.flushed()
//   await swarm.flush()
//   await connecting

//   await execution(connection)
// })

// test('seed SIGTERM shutdown', { skip: process.platform === 'win32' }, async function ({ is, teardown }) {
//   const ride = await rider({
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'seed-test' }
//   })

//   await ride.stage('test')

//   await ride.release('test')

//   const seed = await ride.seed('test')
//   const exiting = once(seed.process, 'exit')
//   seed.process.kill('SIGTERM')
//   const [code] = await exiting

//   is(code, 0)
// })
