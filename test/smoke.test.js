'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const { writeFileSync, unlinkSync } = require('bare-fs')

test('smoke', async function ({ teardown, ok, is, not, plan, timeout, comment }) {
  plan(8)
  timeout(180000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({
    id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', key: null, dir, clientArgv: []
  }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, `seeded platform key (${key})`)
  ok(announced, 'seeding announced')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key, '--debug=ready'], dev: true, key, dir
  }), [{ tag: 'ready' }, { tag: 'exit' }, { tag: 'update1' }, { tag: 'update2' }])

  const ready = await app.ready
  not(ready, undefined, 'app is ready')

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  comment(`creating ${ts}.txt for triggering app update`)
  writeFileSync(path.join(dir, `${ts}.txt`), 'test')
  teardown(() => unlinkSync(path.join(dir, `${ts}.txt`)))

  comment('restaging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('reseeding')
  const reseed = helper.pickMany(helper.seed({
    id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', key: null, dir, clientArgv: []
  }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const reseedKey = await reseed.key
  const reseedAnnounced = await reseed.announced

  ok(reseedKey, `reseeded platform key (${reseedKey})`)
  ok(reseedAnnounced, 'reseed announced')

  const updated = await Promise.any([app.update1, helper.sleep(5000)])
  is(updated?.toString(), '[DEBUG] UPDATE1\n', 'app updated after stage')

  comment('releasing')
  const { released } = await helper.pick(helper.release({
    id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', key,
  }, { close: false }), { tag: 'released' })
  await released

  comment('released')

  const reupdated = await Promise.any([app.update2, helper.sleep(5000)])
  is(reupdated?.toString(), '[DEBUG] UPDATE2\n', 'app reupdated after release')

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})
