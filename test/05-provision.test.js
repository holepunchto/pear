'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const test = require('brittle')
const tmp = require('test-tmp')
const Localdrive = require('localdrive')
const Helper = require('./helper')

test('pear provision syncs blocks from source to target per production key', async ({
  teardown,
  ok,
  plan
}) => {
  plan(2)
  const prod = Helper.fixture('stage-app-min')
  const src = Helper.fixture('sub-dep-require-assets')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const stageLink1 = await Helper.touchLink(helper)

  const srcStaging = helper.stage({
    link: stageLink1,
    dir: src,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(srcStaging))

  const srcStaged = await Helper.pick(srcStaging, [{ tag: 'addendum' }])

  const source = await srcStaged.addendum
  const stageLink2 = await Helper.touchLink(helper)

  const prodStaging = helper.stage({
    link: stageLink2,
    dir: prod,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(prodStaging))

  const prodStaged = await Helper.pick(prodStaging, [{ tag: 'addendum' }])

  const production = await prodStaged.addendum

  const targetLink = await Helper.touchLink(helper)

  const provisioning = helper.provision({
    sourceVerlink: source.verlink,
    targetLink,
    productionVerlink: production.verlink,
    cooldown: 200
  })
  const provisioned = await Helper.pick(provisioning, [{ tag: 'final' }])

  const provision = await provisioned.final

  ok(provision.source.verlink.startsWith('pear://'), 'source verlink is a pear link')
  ok(provision.target.verlink.startsWith('pear://'), 'target verlink is a pear link')
})

test('pear provision removes warmup metadata missing from source', async ({
  teardown,
  ok,
  plan
}) => {
  plan(1)
  const src = await tmp()
  const prod = Helper.fixture('warmup')

  teardown(() => Helper.gc(src))

  const mirror = new Localdrive(dir).mirror(new Localdrive(src), { prune: false })
  await mirror.done()

  const pkgPath = path.join(src, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.version = '1.0.0'
  pkg.pear.stage.skipWarmup = true
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const sourceLink = await Helper.touchLink(helper)
  const sourceStaging = helper.stage({
    link: sourceLink,
    dir: src,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(sourceStaging))
  const sourceStaged = await Helper.pick(sourceStaging, [{ tag: 'addendum' }])
  const source = await sourceStaged.addendum

  const productionLink = await Helper.touchLink(helper)
  const productionStaging = helper.stage({
    link: productionLink,
    dir: prod,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(productionStaging))
  const productionStaged = await Helper.pick(productionStaging, [{ tag: 'addendum' }])
  const production = await productionStaged.addendum

  const targetLink = await Helper.touchLink(helper)

  const provisioning = helper.provision({
    sourceVerlink: source.verlink,
    targetLink,
    productionVerlink: production.verlink,
    cooldown: 0
  })
  teardown(() => Helper.teardownStream(provisioning))

  const provisioned = await Helper.pick(provisioning, [{ tag: 'final' }])
  const provision = await provisioned.final

  ok(provision.target.verlink.startsWith('pear://'), 'provision succeeded')
})
