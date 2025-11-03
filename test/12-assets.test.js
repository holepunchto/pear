const test = require('brittle')
const tmp = require('test-tmp')
const fs = require('bare-fs')
const path = require('bare-path')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const appWithAssetsDir = path.join(
  Helper.localDir,
  'test',
  'fixtures',
  'app-with-assets'
)

test('staged manifest assets fetched by run', async (t) => {
  t.comment('creating test asset')
  const swarm = new Hyperswarm({ bootstrap: Pear.config.dht.bootstrap })
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
  const assetBuffer = Buffer.allocUnsafe(4096)
  await drive.put('/asset', assetBuffer)

  let link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  await updateAsset(link)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  t.comment('running app')
  const base = Pear.app.dir
  Pear.app.dir = appWithAssetsDir
  t.teardown(() => {
    Pear.app.dir = base
  })
  let run = await Helper.run({ link: appWithAssetsDir })
  await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  let data = await helper.data({ resource: 'assets' })
  let assetsPipe = await Helper.pick(data, [{ tag: 'assets' }])
  let assets = await assetsPipe.assets

  const asset = await assets.find((e) => e.link === link)
  t.ok(asset)

  let assetBin = await fs.promises.readFile(path.join(asset.path, 'asset'))
  t.ok(assetBuffer.equals(assetBin), 'on disk asset is fixture asset')

  t.comment('update asset')
  const assetBufferUpdate = Buffer.allocUnsafe(4096)
  await drive.put('/asset', assetBufferUpdate)
  link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  await updateAsset(link)

  t.comment('run app with updated asset')
  run = await Helper.run({ link: appWithAssetsDir })
  await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  data = await helper.data({ resource: 'assets' })
  assetsPipe = await Helper.pick(data, [{ tag: 'assets' }])
  assets = await assetsPipe.assets

  const assetUpdate = await assets.find((e) => e.link === link)
  t.ok(assetUpdate)

  const assetBinUpdate = await fs.promises.readFile(
    path.join(assetUpdate.path, 'asset')
  )
  t.is(assetBufferUpdate.equals(assetBuffer), false, 'asset was updated')
  t.ok(
    assetBufferUpdate.equals(assetBinUpdate),
    'on disk asset is updated fixture asset'
  )

  async function updateAsset(link) {
    const appPkgPath = path.join(appWithAssetsDir, 'package.json')
    const appPkg = JSON.parse(await fs.promises.readFile(appPkgPath, 'utf8'))
    appPkg.pear.assets.ui.link = link
    await fs.promises.writeFile(
      path.join(appWithAssetsDir, 'package.json'),
      JSON.stringify(appPkg, null, 2)
    )

    t.teardown(async () => {
      // revert change in package.json
      appPkg.pear.assets.ui.link = ''
      await fs.promises.writeFile(
        path.join(appWithAssetsDir, 'package.json'),
        JSON.stringify(appPkg, null, 2)
      )
    })
  }
})
