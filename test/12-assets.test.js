const test = require('brittle')
const tmp = require('test-tmp')
const fs = require('bare-fs')
const path = require('bare-path')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const appWithAssetsDir = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-assets')

test('can stage an application with pre', async (t) => {
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

  t.comment('patch app assets')
  const appPkgPath = path.join(appWithAssetsDir, 'package.json')
  const appPkg = JSON.parse(await fs.promises.readFile(appPkgPath, 'utf8'))
  const link = `pear://0.${drive.core.length}.${hypercoreid.encode(drive.key)}`
  appPkg.pear.assets.ui.link = link
  await fs.promises.writeFile(path.join(appWithAssetsDir, 'package.json'), JSON.stringify(appPkg, null, 2))

  t.teardown(async () => {
    // revert change in package.json
    appPkg.pear.assets.ui.link = ''
    await fs.promises.writeFile(path.join(appWithAssetsDir, 'package.json'), JSON.stringify(appPkg, null, 2))
  })

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  t.comment('running app')
  const run = await Helper.run({ link: appWithAssetsDir })
  await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'assets' })
  const assetsPipe = await Helper.pick(data, [{ tag: 'assets' }])
  const assets = await assetsPipe.assets

  t.comment('asset created')
  const asset = await assets.find(e => e.link === link)
  t.ok(asset)

  const assetBin = await fs.promises.readFile(path.join(asset.path, 'asset'))
  t.ok(assetBuffer.equals(assetBin), 'on disk asset equals fixture asset')
})
