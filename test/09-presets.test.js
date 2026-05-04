'use strict'
const test = require('brittle')
const opwait = require('pear-opwait')
const path = require('bare-path')
const Helper = require('./helper')
const flagsDir = path.join(Helper.localDir, 'test', 'fixtures', 'flags')

test('set presets and get presets', async ({ teardown, plan, comment, is, ok }) => {
  plan(7)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)
  const dir = flagsDir

  comment('staging')
  const staging = helper.stage({ link, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  let presets = await getPresets({ link, command: 'stage' })
  is(presets, null, 'initial stage presets should be null')

  presets = await getPresets({
    link,
    command: 'stage',
    flags: '--dry-run --no-ask'
  })

  ok(presets, 'should have one presets')
  is(presets.command, 'stage', 'presets command should be "stage"')
  is(presets.flags, '--dry-run --no-ask', 'presets flags should match')

  presets = await getPresets({ link, command: 'stage' })

  is(presets.command, 'stage', 'stored presets command should be "stage"')
  is(presets.flags, '--dry-run --no-ask', 'stored presets flags should be "--dry-run --no-ask"')

  presets = await getPresets({
    link,
    command: 'stage',
    reset: true
  })
  presets = await getPresets({ link, command: 'stage' })
  is(presets, null, 'initial stage presets should be null after reset')

  async function getPresets({ link, command, flags, reset }) {
    const presetsStream = await helper.presets({
      link,
      command,
      flags,
      reset
    })
    const { presets } = await opwait(presetsStream)
    return presets
  }
})
