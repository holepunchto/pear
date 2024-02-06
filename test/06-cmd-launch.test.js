'use strict'
const { writeFile } = require('fs/promises')
const { join } = require('path')
const test = require('brittle')
const joyrider = require('joyrider')

const rider = joyrider(__filename)

test('holepunch stage, seed, launch', async function ({ teardown, ok }) {
  const ride = await rider({ teardown, app: './fixtures/app' })

  await ride.stage('test')

  const seed = await ride.seed('test')

  ok(seed.key)

  const consumer = await rider({ testnet: ride.testnet, teardown })

  const inspect = await consumer.launch(seed.key)

  ok(await inspect.verify())
})

test('holepunch stage, release, seed, launch', async function ({ teardown, ok }) {
  const ride = await rider({ teardown, app: './fixtures/app' })

  await ride.stage('test')

  await ride.release('test')

  const seed = await ride.seed('test')

  ok(seed.key)

  const consumer = await rider({ testnet: ride.testnet, teardown })

  const inspect = await consumer.launch(seed.key)

  ok(await inspect.verify())
})

test('holepunch stage, release, stage, seed, launch', async function ({ teardown, is, ok }) {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    receptacle: true
  })

  await ride.stage('test')

  await ride.release('test')

  writeFile(join(ride.projectDir, 'index.html'), '<h1>updated</h1>')

  await ride.stage('test')

  const seed = await ride.seed('test')

  ok(seed.key)

  const consumer = await rider({ testnet: ride.testnet, teardown })

  const inspect = await consumer.launch(seed.key)

  is(await inspect.innerText(await inspect.querySelector('h1')), 'Welcome to Holepunch')
})

test('holepunch stage, release, stage, seed, launch --checkout release', async function ({ teardown, is, ok }) {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    receptacle: true
  })

  await ride.stage('test')

  await ride.release('test')

  writeFile(join(ride.projectDir, 'index.html'), '<h1>updated</h1>')

  await ride.stage('test')

  const seed = await ride.seed('test')

  ok(seed.key)

  const consumer = await rider({ testnet: ride.testnet, teardown })

  const inspect = await consumer.launch(seed.key, { checkout: 'release' })

  is(await inspect.innerText(await inspect.querySelector('h1')), 'Welcome to Holepunch')
})

test('holepunch stage, release, stage, seed, launch --checkout latest', async function ({ teardown, is, ok }) {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    receptacle: true
  })

  await ride.stage('test')

  await ride.release('test')

  writeFile(join(ride.projectDir, 'index.html'), '<h1>updated</h1>')

  await ride.stage('test')

  const seed = await ride.seed('test')

  ok(seed.key)

  const consumer = await rider({ testnet: ride.testnet, teardown })

  const inspect = await consumer.launch(seed.key, { checkout: 'latest' })

  is(await inspect.innerText(await inspect.querySelector('h1')), 'updated')
})

test.todo('holepunch stage, release, stage, seed, launch --checkout <seq>')
