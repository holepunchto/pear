'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperbee = require('hyperbee')
const joyrider = require('joyrider')
const hypercoreid = require('hypercore-id-encoding')
const rider = joyrider(__filename)

test('bundle->manifest', async ({ teardown, is }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  const { value } = await bee.get('manifest')
  is(typeof value, 'object')
  is(Array.isArray(value), false)
  is(value.name, name)
  is(value.main, 'index.html')
})

test('bundle->channel', async ({ teardown, is }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  const { value: channel } = await bee.get('channel')
  is(typeof channel, 'string')
  is(channel, 'test')
})

test('bundle->files', async ({ teardown, is, ok }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  const files = []

  for await (const file of (await bee.sub('files')).createReadStream()) {
    files.push(file)
  }

  const isBlob = (value) => {
    return Object.hasOwn(value, 'executable') &&
      Object.hasOwn(value, 'linkname') &&
      Object.hasOwn(value, 'blob') &&
      Number.isInteger(value.blob.byteOffset) &&
      Number.isInteger(value.blob.blockOffset) &&
      Number.isInteger(value.blob.blockLength) &&
      Number.isInteger(value.blob.byteLength)
  }
  is(files[0].key, '/app.js')
  ok(isBlob(files[0].value))
  is(files[1].key, '/index.html')
  ok(isBlob(files[1].value))
  is(files[2].key, '/lazy-loaded.js')
  ok(isBlob(files[2].value))
  is(files[3].key, '/local.js')
  ok(isBlob(files[3].value))
  is(files[4].key, '/non-referenced.js')
  ok(isBlob(files[4].value))
  is(files[5].key, '/package.json')
  ok(isBlob(files[5].value))
})

test('bundle->warmup', async ({ teardown, ok, same }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  const { value: warmup } = await bee.get('warmup')
  ok(Array.isArray(warmup.meta))
  ok(warmup.meta.length > 0)
  ok(warmup.meta.every((n) => Number.isInteger(n)))
  ok(Array.isArray(warmup.data))
  ok(warmup.data.length > 0)
  ok(warmup.data.every((n) => Number.isInteger(n)))
})

test('bundle->release', async ({ teardown, is }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.release('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  is(typeof (await bee.get('release'))?.value, 'number')
})

test('bundle->platformVersion', async ({ teardown, is }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  // this must be updated if we ever bump the bundle LTS version
  is(await bee.get('platformVersion'), null, 'platformVersion should not be set')
})

test('bundle header', async ({ teardown, execution }) => {
  const name = 'bundle-test'

  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name }
  })

  await ride.stage('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace(name + '~test')

  const bee = new Hyperbee(cs.get({ name: 'db', cache: true }), {
    extension: false,
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })

  await bee.ready()

  const header = await bee.getHeader({ wait: false })
  execution(() => hypercoreid.decode(header?.metadata?.contentFeed))
})
