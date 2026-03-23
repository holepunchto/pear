'use strict'
const test = require('brittle')
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
