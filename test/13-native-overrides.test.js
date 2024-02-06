'use strict'
const test = require('brittle')
const joyrider = require('joyrider')
const rider = joyrider(__filename)

const describe = (mod) => Object.entries(mod)
  .sort(([name], [cmp]) => name < cmp ? -1 : 1)
  .map(([name, value]) => ({ name, type: typeof value, value: '' }))

test('crc-universal override', async ({ teardown, alike }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: { test: 'export * from \'crc-universal\'' },
    teardown
  })
  const inspect = await ride.open()
  alike(await inspect.exports('test.js', { describe: true }), await describe((await import('crc-universal')).default))
})

test('quickbit-universal override', async ({ teardown, alike }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
          import * as mod from 'quickbit-universal'
          const describe = (mod) => Object.entries(mod)
            .sort(([ name ], [ cmp ]) => name < cmp ? -1 : 1)
            .map(([name, value]) => ({name, type: typeof value, value: ''}))
          export default describe(mod)
        `
    },
    teardown
  })
  const inspect = await ride.open()

  alike((await inspect.exports('test.js')).default, await describe((await import('quickbit-universal'))))
})

test('sodium-native override', async ({ teardown, alike }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import sodium from 'sodium-native'
        const describe = (mod) => Object.entries(mod)
          .sort(([ name ], [ cmp ]) => name < cmp ? -1 : 1)
          .map(([name, value]) => ({name, type: typeof value, value: ''}))
        export default describe(sodium)
      `
    },
    teardown
  })
  const inspect = await ride.open()
  alike((await inspect.exports('test.js')).default, await describe((await import('sodium-native')).default))
})

test('udx-native override', async ({ teardown, is }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
          import cls from 'udx-native'
          export const { name } = cls
        `
    },
    teardown
  })
  const inspect = await ride.open()
  is((await inspect.exports('test.js')).name, (await import('udx-native')).default.name)
})

test('fs-native-extensions override', async ({ teardown, is }) => {
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
          import cls from 'fs-native-extensions'
          export const name = cls.tryLock.name
        `
    },
    teardown
  })
  const inspect = await ride.open()
  is((await inspect.exports('test.js')).name, (await import('fs-native-extensions')).default.tryLock.name)
})
