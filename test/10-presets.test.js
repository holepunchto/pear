'use strict'
const test = require('brittle')
const opwait = require('pear-opwait')
const path = require('bare-path')
const Helper = require('./helper')
const flagsDir = path.join(Helper.localDir, 'test', 'fixtures', 'flags')

test('set presets and get presets', async ({ teardown, plan, comment, is, ok }) => {
  plan(9)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)
  const dir = flagsDir

  comment('staging')
  const staging = helper.stage({ link, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.final

  await staged.addendum

  let presets = await getPresets({ link, command: 'run' })
  is(presets, null, 'initial run presets should be null')

  presets = await getPresets({
    link,
    command: 'run',
    flags: '--dev --no-ask'
  })

  ok(presets, 'should have one presets')
  is(presets.command, 'run', 'presets command should be "run"')
  is(presets.flags, '--dev --no-ask', 'presets flags should match')

  presets = await getPresets({ link, command: 'run' })

  is(presets.command, 'run', 'stored presets command should be "run"')
  is(presets.flags, '--dev --no-ask', 'stored presets flags should be "--dev --no-ask"')

  const run = await Helper.run({ link })
  const result = await Helper.untilResult(run.pipe)
  const flags = JSON.parse(result)
  is(flags.dev, true, 'dev flag is set')
  is(flags.ask, false, 'no-ask flag is set')
  await Helper.untilClose(run.pipe)

  presets = await getPresets({
    link,
    command: 'run',
    reset: true
  })
  presets = await getPresets({ link, command: 'run' })
  is(presets, null, 'initial run presets should be null after reset')

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
