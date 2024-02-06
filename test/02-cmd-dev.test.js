'use strict'
const { join } = require('path')
const { appendFileSync } = require('fs')
const test = require('brittle')
const joyrider = require('joyrider')

const rider = joyrider(__filename)

test('holepunch dev opens an app in Holepunch, making requests to the file system via the app:// protocol', async ({ alike, plan, teardown }) => {
  plan(1)

  const ride = await rider({
    app: './fixtures/app',
    teardown
  })
  const client = await ride.open({ network: { record: true } })

  const expected = [
    'app://app/index.html',
    'app://app/app.js',
    'app://esm/local.js',
    'app://esm/lazy-loaded.js'
  ]
  await client.network.tally(expected.length)

  alike(expected, client.network.requests.map(({ request }) => request.url))
})

test('holepunch dev: requests are handled by loading files from the local filesystem', async ({ plan, not, ok, teardown }) => {
  plan(2)

  const ride = await rider({
    app: './fixtures/app',
    vars: {}, // trigger templating to 'injected line' is thrown away
    teardown
  })

  const client = await ride.open({ network: { record: true } })

  not(/console\.log\('injected line'\)/.test(await client.network.responseBody('app://app/app.js')))

  appendFileSync(join(ride.projectDir, 'app.js'), '\nconsole.log(\'injected line\')\n')

  await client.reload()

  ok(/console\.log\('injected line'\)/.test(await client.network.responseBody('app://app/app.js')))
})

test.todo('holepunch dev watch-reload (js)')

test.todo('holepunch dev watch-reload (html)')

test.todo('holepunch dev watch-reload (css)')

test.todo('holepunch dev watch-reload (images)')

test.todo('holepunch dev watch-reload (unknown)')

test.todo('holepunch dev --no-watch')

test.todo('holepunch dev opens devtools')

test.todo('holepunch dev --no-tools')

test.todo('holepunch dev --launch')
