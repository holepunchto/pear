const test = require('brittle')
const tmp = require('test-tmp')
const fs = require('bare-fs')
const path = require('bare-path')
const ref = require('pear-ref')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const Localdrive = require('localdrive')
const { spawn } = require('bare-subprocess')

const appWithAssetsDir = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'app-with-assets'
)

test('preflight downloads staged assets', async (t) => {
  t.plan(3)
  t.comment('creating test asset')
  const swarm = new Hyperswarm({ bootstrap: Pear.config.dht.bootstrap })
  const tmpdir = await tmp()
  const store = new Corestore(tmpdir)
  await store.ready()
  const drive = new Hyperdrive(store)
  await drive.ready()
  t.teardown(() => swarm.destroy())
  const appWithAssetsDrive = new Localdrive(appWithAssetsDir)

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const assetBuffer = Buffer.allocUnsafe(4096)
  await drive.put('/asset', assetBuffer)

  const appPkg = JSON.parse(await appWithAssetsDrive.get('/package.json'))
  const link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  appPkg.pear.assets.ui.link = link
  await appWithAssetsDrive.put('/package.json', JSON.stringify(appPkg, null, 2))

  t.teardown(async () => {
    // revert change in package.json
    appPkg.pear.assets.ui.link = ''
    await appWithAssetsDrive.put(
      '/package.json',
      JSON.stringify(appPkg, null, 2)
    )
  })

  t.comment('running app with preflight flag')

  const dhtBootstrap = Pear.config.dht.bootstrap
    .map((e) => `${e.host}:${e.port}`)
    .join(',')

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })

  const { pipe } = await Helper.rawRun({
    argv: [
      '--preflight',
      '--dht-bootstrap',
      dhtBootstrap,
      '--base',
      appWithAssetsDir,
      '--no-pre'
    ],
    link: `file://${appWithAssetsDir}`
  })

  await helper.ready()

  await t.execution(
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), 1000)
      pipe.once('data', (d) => {
        console.log(d)
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
  const assetData = await Helper.pick(data, [{ tag: 'assets' }])
  const asset = (await assetData.assets).find((a) => a.link === link)
  t.ok(asset)

  const assetBin = await new Localdrive(asset.path).get('/asset')
  t.ok(assetBuffer.equals(assetBin), 'on disk asset is fixture asset')
})
