'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const path = require('bare-path')
const HyperDB = require('hyperdb')
const { spec, Model } = require('../subsystems/sidecar/lib/db')

async function tmpRocks() {
  const dir = await tmp()
  const rocks = HyperDB.rocks(path.join(dir, 'rocks.db'), spec)
  return { rocks, dir }
}

test('DHT', async function (t) {
  const { rocks } = await tmpRocks()
  const model = new Model(rocks)
  await model.db.ready()
  const nodes = [
    { host: '127.0.0.1', port: 1234 },
    { host: 'holepunch.to', port: 8080 }
  ]
  await model.setDhtNodes(nodes)
  t.alike(await model.getDhtNodes(), nodes)
  await model.close()
})
