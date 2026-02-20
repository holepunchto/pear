const test = require('brittle')
const opwait = require('pear-opwait')
const tmp = require('test-tmp')
const { Transform, pipeline } = require('streamx')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Localdrive = require('localdrive')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const ref = require('pear-ref')
const { pathToFileURL } = require('bare-url')
const { spawn } = require('bare-subprocess')
const Helper = require('./helper')

const rig = new Helper.Rig()

test('pear run staged manifest assets fetched', async (t) => {
  t.comment('creating test asset')
  const swarm = new Hyperswarm({ bootstrap: Pear.app.dht.bootstrap })
  const tmpdir = await tmp()
  const store = new Corestore(tmpdir)
  await store.ready()
  const drive = new Hyperdrive(store)
  await drive.ready()
  t.teardown(() => swarm.destroy())

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const assetBuffer = crypto.randomBytes(4096)
  await drive.put('/asset', assetBuffer)
  const dir = Helper.fixture('app-with-assets')
  const fixture = new Localdrive(dir)
  const appPkg = JSON.parse(await fixture.get('/package.json'))
  const link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  appPkg.pear.assets.ui.link = link
  await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))

  t.teardown(async () => {
    // revert change in package.json
    appPkg.pear.assets.ui.link = ''
    await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))
  })

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  t.comment('running app')
  const base = Pear.app.dir
  Pear.app.dir = dir
  t.teardown(() => {
    Pear.app.dir = base
  })

  const run = await Helper.run({ link: dir })
  const result = await Helper.untilResult(run.pipe)
  t.is(result, 'hello')
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'assets' })
  const { assets } = await opwait(data)

  const asset = await assets.find((e) => e.link === link)
  t.ok(asset)

  const assetTarget = new Localdrive(asset.path)
  const assetBin = await assetTarget.get('asset')
  t.ok(assetBuffer.equals(assetBin), 'on disk asset is fixture asset')
})

test('pear run preflight downloads staged assets', async (t) => {
  t.plan(3)
  t.comment('creating test asset')
  const swarm = new Hyperswarm({ bootstrap: Pear.app.dht.bootstrap })
  const tmpdir = await tmp()
  const store = new Corestore(tmpdir)
  await store.ready()
  const drive = new Hyperdrive(store)
  await drive.ready()
  t.teardown(() => swarm.destroy())
  const dir = Helper.fixture('app-with-assets')
  const fixture = new Localdrive(dir)

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const assetBuffer = Buffer.allocUnsafe(4096)
  await drive.put('/asset', assetBuffer)

  const appPkg = JSON.parse(await fixture.get('/package.json'))
  const link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  appPkg.pear.assets.ui.link = link
  await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))

  t.teardown(async () => {
    // revert change in package.json
    appPkg.pear.assets.ui.link = ''
    await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))
  })

  t.comment('running app with preflight flag')

  const dhtBootstrap = Pear.app.dht.bootstrap.map((e) => `${e.host}:${e.port}`).join(',')

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  // NB: we spawn directly instead of using Helper.run to avoid unwanted
  //        call to pipe.end

  const sp = spawn(
    helper.runtime,
    [
      'run',
      '--preflight',
      '--dht-bootstrap',
      dhtBootstrap,
      '--base',
      dir,
      '--trusted',
      '--no-pre',
      pathToFileURL(dir)
    ],
    {
      stdio: ['inherit', 'inherit', 'inherit', 'overlapped'],
      windowsHide: true
    }
  )
  ref.ref()
  sp.once('exit', (exitCode) => {
    ref.unref()
  })
  const pipe = sp.stdio[3]

  await helper.ready()

  await t.execution(
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), 1000)
      pipe.once('data', () => {
        reject(new Error('unexpected data'))
      })
      pipe.on('end', () => {
        clearTimeout(timeoutId)
        resolve()
      })
    }),
    'stream ends without sending data'
  )

  const data = await helper.data({ resource: 'assets' })
  const { assets } = await opwait(data)
  const asset = assets.find((a) => a.link === link)

  t.ok(asset)

  const assetBin = await new Localdrive(asset.path).get('/asset')
  t.ok(assetBuffer.equals(assetBin), 'on disk asset is fixture asset')
})

test('pear run preflight downloads staged assets from key', async (t) => {
  t.plan(4)
  t.comment('creating test asset')
  const swarm = new Hyperswarm({ bootstrap: Pear.app.dht.bootstrap })
  const tmpdir = await tmp()
  const store = new Corestore(tmpdir)
  await store.ready()
  const drive = new Hyperdrive(store)
  await drive.ready()
  t.teardown(() => swarm.destroy())
  const dir = Helper.fixture('app-with-assets')
  const fixture = new Localdrive(dir)

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const assetBuffer = Buffer.allocUnsafe(4096)
  await drive.put('/asset', assetBuffer)

  const appPkg = JSON.parse(await fixture.get('/package.json'))
  const link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  appPkg.pear.assets.ui.link = link
  await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))

  t.teardown(async () => {
    // revert change in package.json
    appPkg.pear.assets.ui.link = ''
    await fixture.put('/package.json', JSON.stringify(appPkg, null, 2))
  })

  t.comment('running app with preflight flag')

  const dhtBootstrap = Pear.app.dht.bootstrap.map((e) => `${e.host}:${e.port}`).join(',')

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const appLink = await Helper.touchLink(helper)

  t.comment('staging')
  const staging = helper.stage({
    link: appLink,
    dir,
    dryRun: false,
    bare: true
  })
  t.teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.addendum
  await staged.final

  const sp = spawn(
    helper.runtime,
    [
      'run',
      '--preflight',
      '--json',
      '--dht-bootstrap',
      dhtBootstrap,
      '--base',
      dir,
      '--trusted',
      '--no-pre',
      appLink
    ],
    {
      stdio: ['inherit', 'pipe', 'inherit', 'overlapped'],
      windowsHide: true
    }
  )
  ref.ref()
  sp.once('exit', () => {
    ref.unref()
  })
  const pipe = sp.stdio[3]

  await helper.ready()

  await t.execution(
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), 1000)
      pipe.once('data', () => {
        reject(new Error('unexpected data'))
      })
      pipe.on('end', () => {
        clearTimeout(timeoutId)
        resolve()
      })
    }),
    'stream ends without sending data'
  )

  const transform = new Transform({
    transform(from, cb) {
      try {
        this.push(JSON.parse(from.toString()))
      } catch {
      } finally {
        cb()
      }
    }
  })

  const stats = await Helper.pick(pipeline(sp.stdio[1], transform), {
    tag: 'stats'
  })
  t.is(stats, 1, 'preflight emits 1 when is finished')

  const data = await helper.data({ resource: 'assets' })
  const { assets } = await opwait(data)
  const asset = assets.find((a) => a.link === link)

  t.ok(asset)

  const assetBin = await new Localdrive(asset.path).get('/asset')
  t.ok(assetBuffer.equals(assetBin), 'on disk asset is fixture asset')
})

test('pear run entrypoint and fragment', async function ({ is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const dir = Helper.fixture('entrypoint-and-fragment')
  const entrypoint = '/entrypoint.js'
  const fragment = Helper.getRandomId().toString()

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.addendum
  await staged.final

  const runLink = `${link}${entrypoint}#${fragment}`
  const run = await Helper.run({ link: runLink })

  const result = await Helper.untilResult(run.pipe)
  const info = JSON.parse(result)

  is(info.entrypoint, entrypoint)
  is(info.fragment, fragment)

  await Helper.untilClose(run.pipe)
})

test('pear run app routes + linkData', async ({ teardown, comment, ok, is }) => {
  const dir = Helper.fixture('routes')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const linkData = 'link-data'
  const appLink = `${link}/${linkData}`
  const run = await Helper.run({ link: appLink })

  const result = await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)
  is(result, linkData)

  const routeLink = `${link}/subdir/index.js`
  const routeRun = await Helper.run({ link: routeLink })
  const expected = 'this-is-subdir'
  const routeResult = await Helper.untilResult(routeRun.pipe)
  is(routeResult, expected)
  await Helper.untilClose(routeRun.pipe)
})

test.hook('encrypted run setup', rig.setup)

test('stage, seed and run encrypted app', async function ({
  ok,
  is,
  plan,
  comment,
  timeout,
  teardown
}) {
  timeout(180000)
  plan(6)

  const dir = Helper.fixture('encrypted')

  const helper = new Helper(rig)
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const permitHelper = new Helper()
  teardown(() => permitHelper.close(), { order: Infinity })
  await permitHelper.ready()

  const password = hypercoreid.encode(crypto.randomBytes(32))

  const touching = await helper.touch()
  const touched = await Helper.pick(touching, [{ tag: 'final' }])
  const { key, link } = await touched.final

  comment('staging throws without encryption key')
  const stagingA = helper.stage({ link, dir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingA))
  const error = await Helper.pick(stagingA, { tag: 'error' })
  is(error.code, 'ERR_PERMISSION_REQUIRED')

  await helper.permit({ key: hypercoreid.decode(key), password })

  comment('staging with encryption key')
  const stagingB = helper.stage({ link, dir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingB))
  const final = await Helper.pick(stagingB, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding encrypted app')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  await permitHelper.permit({ key: hypercoreid.decode(key), password })
  const { pipe } = await Helper.run({ link })

  const result = await Helper.untilResult(pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test.hook('encrypted run cleanup', rig.cleanup)
