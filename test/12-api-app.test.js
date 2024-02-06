'use strict'
const { join } = require('path')
const hypercoreid = require('hypercore-id-encoding')
const test = require('brittle')
const joyrider = require('joyrider')

const rider = joyrider(__filename)

test('app.key (dev)', async ({ is, plan, teardown }) => {
  plan(2)
  const ride = await rider({ app: './fixtures/app', teardown })
  const inspect = await ride.open()
  const app = await inspect.exports('holepunch://app')
  is(app.default.key, 'dev')
  is(app.key, 'dev')
})

test('app.key (staged)', async ({ is, plan, teardown }) => {
  plan(2)
  const ride = await rider({ show: true, app: './fixtures/app', vars: { name: 'app-key-staged' }, teardown })
  await ride.stage('test')
  const seed = await ride.seed('test')
  const inspect = await ride.launch(seed.key)
  const app = await inspect.exports('holepunch://app')

  is(app.default.key, seed.key)
  is(app.key, seed.key)
})

test('app.key (released)', async ({ is, plan, teardown }) => {
  plan(2)
  const ride = await rider({ app: './fixtures/app', teardown })
  await ride.stage('test')
  await ride.release('test')
  const seed = await ride.seed('test')
  const inspect = await ride.launch(seed.key)
  const app = await inspect.exports('holepunch://app')

  is(app.default.key, seed.key)
  is(app.key, seed.key)
})

test('app.config (dev) ', async ({ alike, is, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    mem: false,
    vars: {
      name: 'app-config',
      test: `
        import util from 'util'
        import * as app from 'holepunch://app'
        export const exportedConfig = Object.assign({}, app.config)
        export const instanceConfig = Object.assign({}, app.default.config)
      `
    }
  })
  const inspect = await ride.open()
  const { exportedConfig, instanceConfig } = await inspect.exports('test.js')
  alike(exportedConfig, instanceConfig)
  alike(exportedConfig, {
    key: null,
    options: {},
    checkpoint: null,
    flags: {
      tools: true,
      watch: false,
      stage: false,
      dev: true,
      mem: false,
      dry: false,
      run: false,
      checkout: 'release'
    },
    dev: true,
    tier: 'dev',
    tools: true,
    watch: false,
    stage: false,
    storage: join(ride.configDir, 'app-storage', 'local-app-config'),
    name: 'app-config',
    main: 'index.html',
    dependencies: {},
    args: [],
    channel: null,
    release: null,
    memoryMode: false,
    dht: ride.testnet.bootstrap
  })
})

test('app.config (staged) ', async ({ alike, is, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    mem: false,
    vars: {
      name: 'app-config',
      test: `
        import util from 'util'
        import * as app from 'holepunch://app'
        export const exportedConfig = Object.assign({}, app.config)
        export const instanceConfig = Object.assign({}, app.default.config)
      `
    }
  })
  await ride.stage('test-staging')
  const seed = await ride.seed('test-staging')
  const inspect = await ride.launch(seed.key)
  const { exportedConfig, instanceConfig } = await inspect.exports('test.js')
  alike(exportedConfig, instanceConfig)
  alike(exportedConfig, {
    key: { z32: seed.key, hex: hypercoreid.decode(seed.key).toString('hex') },
    options: {},
    checkpoint: null,
    flags: {
      tools: false,
      watch: false,
      stage: false,
      dev: false,
      mem: true,
      dry: false,
      launch: seed.key,
      run: false,
      checkout: 'release'
    },
    dev: false,
    tier: 'staging',
    tools: false,
    watch: false,
    stage: false,
    storage: join(ride.configDir, 'app-storage', hypercoreid.decode(seed.key).toString('hex')),
    name: 'app-config',
    main: 'index.html',
    dependencies: {},
    args: [],
    channel: 'test-staging',
    memoryMode: true,
    dht: ride.testnet.bootstrap
  })
})

test('app.config (released) ', async ({ alike, is, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    mem: false,
    vars: {
      name: 'app-config',
      test: `
        import util from 'util'
        import * as app from 'holepunch://app'
        export const exportedConfig = Object.assign({}, app.config)
        export const instanceConfig = Object.assign({}, app.default.config)
      `
    }
  })
  await ride.stage('test-released')
  await ride.release('test-released')
  const seed = await ride.seed('test-released')

  const inspect = await ride.launch(seed.key)

  const { exportedConfig, instanceConfig } = await inspect.exports('test.js')
  alike(exportedConfig, instanceConfig)

  alike(exportedConfig, {
    key: { z32: seed.key, hex: hypercoreid.decode(seed.key).toString('hex') },
    options: {},
    checkpoint: null,
    flags: {
      tools: false,
      watch: false,
      stage: false,
      dev: false,
      mem: true,
      dry: false,
      launch: seed.key,
      run: false,
      checkout: 'release'
    },
    dev: false,
    tier: 'production',
    tools: false,
    watch: false,
    stage: false,
    storage: join(ride.configDir, 'app-storage', hypercoreid.decode(seed.key).toString('hex')),
    name: 'app-config',
    main: 'index.html',
    dependencies: {},
    args: [],
    channel: 'test-released',
    release: typeof exportedConfig.release === 'number' ? exportedConfig.release : -Infinity,
    memoryMode: true,
    dht: ride.testnet.bootstrap
  })
})

test('app.config (staged post-release) ', async ({ alike, is, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    mem: false,
    vars: {
      name: 'app-config',
      test: `
        import util from 'util'
        import * as app from 'holepunch://app'
        export const exportedConfig = Object.assign({}, app.config)
        export const instanceConfig = Object.assign({}, app.default.config)
      `
    }
  })
  await ride.stage('test-staged-post-release')
  await ride.release('test-staged-post-release')
  await ride.stage('test-staged-post-release')
  const seed = await ride.seed('test-staged-post-release')

  const inspect = await ride.launch(seed.key)

  const { exportedConfig, instanceConfig } = await inspect.exports('test.js')
  alike(exportedConfig, instanceConfig)

  alike(exportedConfig, {
    key: { z32: seed.key, hex: hypercoreid.decode(seed.key).toString('hex') },
    options: {},
    checkpoint: null,
    flags: {
      tools: false,
      watch: false,
      stage: false,
      dev: false,
      mem: true,
      dry: false,
      launch: seed.key,
      run: false,
      checkout: 'release'
    },
    dev: false,
    tier: 'production',
    tools: false,
    watch: false,
    stage: false,
    storage: join(ride.configDir, 'app-storage', hypercoreid.decode(seed.key).toString('hex')),
    name: 'app-config',
    main: 'index.html',
    dependencies: {},
    args: [],
    channel: 'test-staged-post-release',
    release: typeof exportedConfig.release === 'number' ? exportedConfig.release : -Infinity,
    memoryMode: true,
    dht: ride.testnet.bootstrap
  })
})

test('app.config (staged post-release launch --checkout latest) ', async ({ alike, is, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    mem: false,
    vars: {
      name: 'app-config',
      test: `
        import util from 'util'
        import * as app from 'holepunch://app'
        export const exportedConfig = Object.assign({}, app.config)
        export const instanceConfig = Object.assign({}, app.default.config)
      `
    }
  })
  await ride.stage('test-staged-post-release-launch-checkout-latest')
  await ride.release('test-staged-post-release-launch-checkout-latest')
  await ride.stage('test-staged-post-release-launch-checkout-latest')
  const seed = await ride.seed('test-staged-post-release-launch-checkout-latest')

  const inspect = await ride.launch(seed.key, { checkout: 'latest' })

  const { exportedConfig, instanceConfig } = await inspect.exports('test.js')

  alike(exportedConfig, instanceConfig)

  alike(exportedConfig, {
    options: {},
    checkpoint: null,
    key: { z32: seed.key, hex: hypercoreid.decode(seed.key).toString('hex') },
    flags: {
      tools: false,
      watch: false,
      stage: false,
      dev: false,
      mem: true,
      dry: false,
      checkout: 'latest',
      launch: seed.key,
      run: false
    },
    dev: false,
    tier: 'staging',
    tools: false,
    watch: false,
    stage: false,
    storage: join(ride.configDir, 'app-storage', hypercoreid.decode(seed.key).toString('hex')),
    name: 'app-config',
    main: 'index.html',
    dependencies: {},
    args: [],
    channel: 'test-staged-post-release-launch-checkout-latest',
    release: null,
    memoryMode: true,
    dht: ride.testnet.bootstrap
  })
})

test('app.preferences', async ({ teardown, is, alike }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/template',
    vars: {
      test: `
        import { preferences } from 'holepunch://app'
        export const updatesIter = []
        async function updates () {
          for await (const update of preferences()) updatesIter.push(update)
        }
        updates()
        export const iteration = []
        export const set = await preferences.set('test-key', 'test-val')
        export const set2 = await preferences.set('test-key2', 'test-val2')
        for await (const entry of preferences.list()) iteration.push(entry)
        export const get = await preferences.get('test-key')
        export const del = await preferences.del('test-key')
        export const delConfirm = await preferences.get('test-key') === null
        export const get2 = await preferences.get('test-key2')
        export const del2 = await preferences.del('test-key2')
      `
    }
  })

  const inspect = await ride.open()

  const exports = await inspect.exports('test.js')

  is(exports.set, true)
  is(exports.set2, true)
  is(exports.get, 'test-val')
  is(exports.get2, 'test-val2')
  is(exports.del, true)
  is(exports.del2, true)
  is(exports.delConfirm, true)
  alike(exports.iteration, [['test-key', 'test-val'], ['test-key2', 'test-val2']])
})

test('app.media.desktopSources (dev)', async ({ ok, teardown }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      name: 'media-test',
      test: `
        import app, { media } from 'holepunch://app'
        export const defaultDesktopSource = await app.media.desktopSources({
          types: ['screen', 'window']
        })
        export const exportedDesktopSource = await media.desktopSources({
          types: ['screen', 'window']
        })

      `
    },
    teardown
  })
  const inspect = await ride.open()
  const result = await inspect.exports('test.js')
  ok(Array.isArray(result.defaultDesktopSource))
  ok(result.defaultDesktopSource.length > 0)
  ok(Array.isArray(result.exportedDesktopSource))
  ok(result.exportedDesktopSource.length > 0)
})

test('app.media.desktopSources (staged)', async ({ ok, teardown }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      name: 'media-test',
      test: `
        import app, { media } from 'holepunch://app'
        export const defaultDesktopSource = await app.media.desktopSources({
          types: ['screen', 'window']
        })
        export const exportedDesktopSource = await media.desktopSources({
          types: ['screen', 'window']
        })

      `
    },
    teardown
  })
  await ride.stage('test')
  const seed = await ride.seed('test')
  const inspect = await ride.launch(seed.key)
  const result = await inspect.exports('test.js')
  ok(Array.isArray(result.defaultDesktopSource))
  ok(result.defaultDesktopSource.length > 0)
  ok(Array.isArray(result.exportedDesktopSource))
  ok(result.exportedDesktopSource.length > 0)
})

test('app.media.desktopSources (released)', async ({ ok, teardown }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      name: 'media-test',
      test: `
        import app, { media } from 'holepunch://app'
        export const defaultDesktopSource = await app.media.desktopSources({
          types: ['screen', 'window']
        })
        export const exportedDesktopSource = await media.desktopSources({
          types: ['screen', 'window']
        })

      `
    },
    teardown
  })
  await ride.stage('test')
  await ride.release('test')
  const seed = await ride.seed('test')
  const inspect = await ride.launch(seed.key)
  const result = await inspect.exports('test.js')
  ok(Array.isArray(result.defaultDesktopSource))
  ok(result.defaultDesktopSource.length > 0)
  ok(Array.isArray(result.exportedDesktopSource))
  ok(result.exportedDesktopSource.length > 0)
})

// test('app.checkpoint() & app.config.checkpoint (released)', async ({ alike, teardown }) => {
//   const ride = await rider({
//     app: './fixtures/template',
//     show: true,
//     vars: {
//       name: 'checkpoint-test',
//       test: `
//         import app, { checkpoint, config } from 'holepunch://app'

//         export default config.checkpoint

//         await checkpoint({some: 'state'})
//       `
//     },
//     teardown
//   })
//   // await ride.stage('test')
//   // await ride.release('test')
//   // const seed = await ride.seed('test')
//   // const inspect = await ride.launch(seed.key)
//   let inspect = await ride.open()
//   let result = await inspect.exports('test.js')
//   console.log(result)
//   await ride.close()
//   inspect = await ride.open()
//   result = await inspect.exports('test.js')
//   console.log(result)
//   // alike(result.default, { some: 'state' })
// })
