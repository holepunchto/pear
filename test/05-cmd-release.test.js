'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const joyrider = require('joyrider')
const rider = joyrider(__filename)

test('holepunch release', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'stage-test' }
  })

  await ride.stage('test')

  await ride.release('test')

  await ride.close()

  const store = new Corestore(ride.storageDir)

  const cs = store.namespace('stage-test~test')

  const drive = new Hyperdrive(cs)

  await drive.ready()

  is((await drive.db.get('channel'))?.value, 'test')
})
