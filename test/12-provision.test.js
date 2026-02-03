'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear provision syncs blocks from source to target per production key', async ({
  teardown,
  is,
  plan
}) => {
  plan(1)
  const prod = Helper.fixture('stage-app-min')
  const src = Helper.fixture('sub-dep-require-assets')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  const srcStaging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir: src,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(srcStaging))

  const srcStaged = await Helper.pick(srcStaging, [{ tag: 'addendum' }])

  const source = await srcStaged.addendum

  const id2 = Helper.getRandomId()

  const prodStaging = helper.stage({
    channel: `test-${id2}`,
    name: `test-${id2}`,
    dir: prod,
    dryRun: false,
    compact: true
  })
  teardown(() => Helper.teardownStream(prodStaging))

  const prodStaged = await Helper.pick(prodStaging, [{ tag: 'addendum' }])

  const production = await prodStaged.addendum

  const touching = helper.touch()
  const touched = await Helper.pick(touching, [{ tag: 'final' }])

  const target = await touched.final

  const provisioning = helper.provision({
    sourceLink: source.verlink,
    targetLink: target.link,
    productionLink: production.verlink,
    cooldown: 200
  })
  const provisioned = await Helper.pick(provisioning, [{ tag: 'final' }])
  let fieldUpdates = 0
  provisioning.on('data', (data) => {
    if (data.tag === 'setting' || data.tag === 'unsetting') fieldUpdates += 1
  })

  const provision = await provisioned.final

  const srcRun = await Helper.run({ link: provision.source.verlink })

  const targetRun = await Helper.run({ link: provision.target.verlink })

  const srcResult = await Helper.untilResult(srcRun.pipe)
  const targetResult = await Helper.untilResult(targetRun.pipe)

  is(srcResult, targetResult)

  await Helper.untilClose(srcRun.pipe)
  await Helper.untilClose(targetRun.pipe)
})
