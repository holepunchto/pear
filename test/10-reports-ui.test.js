'use strict'
const test = require('brittle')
const joyrider = require('joyrider')
const rider = joyrider(__filename)

test('upgrade screen shown if platformVersion bundle field is non-null', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'ugprade-screen-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')

  const inspect = await ride.launch(seed.key)

  const { value } = await inspect.run(`
    const ipcRenderer = window[Symbol.for('pear.ipcRenderer')]
    const id = window[Symbol.for('pear.id')]
    await ipcRenderer.invoke(id + ':internal:bundledb', 'put', 'platformVersion', '99999')
    await ipcRenderer.invoke(id + ':internal:bundledb', 'get', 'platformVersion')
  `)

  is(value, '99999')

  const decal = await ride.launch(seed.key, { inspect: 'decal.html' })

  // wait for decal to do loading/anim stuff that can happen
  // prior to the report being displayed:
  await new Promise((resolve) => setTimeout(resolve, 500))

  const report = await decal.querySelector('decal-report')

  const attributes = await decal.attributes(report)

  is(attributes.show, 'upgrade')
})

test('generic error screen', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'error-screen-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')

  const inspect = await ride.launch(seed.key)

  await inspect.run(`
    const ipcRenderer = window[Symbol.for('pear.ipcRenderer')]
    const id = window[Symbol.for('pear.id')]
    const err = { message: 'test' }
    await ipcRenderer.invoke(id + ':app:createReport', err)
  `)

  const decal = await ride.inspect('decal.html')

  const report = await decal.querySelector('decal-report')

  const attributes = await decal.attributes(report)

  is(attributes.show, 'generic')
})

test('dev error screen', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'error-screen-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')

  const inspect = await ride.launch(seed.key)

  await inspect.run(`
    const ipcRenderer = window[Symbol.for('pear.ipcRenderer')]
    const id = window[Symbol.for('pear.id')]
    const err = { message: 'test', code: 'ERR_OPEN' }
    await ipcRenderer.invoke(id + ':app:createReport', err)
  `)

  const decal = await ride.inspect('decal.html')

  const report = await decal.querySelector('decal-report')

  const attributes = await decal.attributes(report)

  is(attributes.show, 'dev')
})

test('connection error screen', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'error-screen-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')

  const inspect = await ride.launch(seed.key)

  await inspect.run(`
    const ipcRenderer = window[Symbol.for('pear.ipcRenderer')]
    const id = window[Symbol.for('pear.id')]
    const err = { message: 'test', code: 'ERR_CONNECTION' }
    await ipcRenderer.invoke(id + ':app:createReport', err)
  `)

  const decal = await ride.inspect('decal.html')

  const report = await decal.querySelector('decal-report')

  const attributes = await decal.attributes(report)

  is(attributes.show, 'connection')
})

test('crash error screen', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'error-screen-test' }
  })

  await ride.stage('test')

  const seed = await ride.seed('test')

  const inspect = await ride.launch(seed.key)

  await inspect.run(`
    const ipcRenderer = window[Symbol.for('pear.ipcRenderer')]
    const id = window[Symbol.for('pear.id')]
    const err = { message: 'test', code: 'ERR_CRASH' }
    await ipcRenderer.invoke(id + ':app:createReport', err)
  `)

  const decal = await ride.inspect('decal.html')

  const report = await decal.querySelector('decal-report')

  const attributes = await decal.attributes(report)

  is(attributes.show, 'crash')
})
