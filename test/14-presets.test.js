'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const versionsDir = path.join(Helper.localDir, 'test', 'fixtures', 'versions')

test('set preset and get preset', async ({ teardown, plan, comment, is }) => {
  plan(6)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const channel = `test-${id}`
  const dir = versionsDir

  comment('staging')
  const staging = helper.stage({ channel, name: channel, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  await staged.final

  const { key } = await staged.addendum
  const link = `pear://${key}`

  const runPresetStream = await helper.presets({ link, command: 'run' })
  teardown(() => Helper.teardownStream(runPresetStream))

  const { preset: initialPreset } = await Helper.pick(runPresetStream, [
    { tag: 'preset' }
  ])
  is(await initialPreset, null, 'initial run preset should be null')

  const setRunPresetStream = await helper.presets({
    link,
    command: 'run',
    configuration: '--dev'
  })
  teardown(() => Helper.teardownStream(setRunPresetStream))

  const { preset: setRunPreset } = await Helper.pick(setRunPresetStream, [
    { tag: 'preset' }
  ])
  const { presets } = await setRunPreset

  is(presets.length, 1, 'should have one preset')
  is(presets[0].command, 'run', 'preset command should be "run"')
  is(presets[0].configuration, '--dev', 'preset config should match')

  const presetUpdatedStream = await helper.presets({ link, command: 'run' })
  teardown(() => Helper.teardownStream(presetUpdatedStream))

  const { preset: presetUpdated } = await Helper.pick(presetUpdatedStream, [
    { tag: 'preset' }
  ])
  const preset = await presetUpdated

  is(preset.command, 'run', 'stored preset command should be "run"')
  is(preset.configuration, '--dev', 'stored preset config should be "--dev"')
})
