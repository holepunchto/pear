'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const flagsDir = path.join(Helper.localDir, 'test', 'fixtures', 'flags')

test('set preset and get preset', async ({
  teardown,
  plan,
  comment,
  is,
  ok
}) => {
  plan(9)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const channel = `test-${id}`
  const dir = flagsDir

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

  let preset = await presets({ link, command: 'run' })
  is(preset, null, 'initial run preset should be null')

  preset = await presets({
    link,
    command: 'run',
    configuration: '--dev --no-ask'
  })

  ok(preset, 'should have one preset')
  is(preset.command, 'run', 'preset command should be "run"')
  is(preset.configuration, '--dev --no-ask', 'preset config should match')

  preset = await presets({ link, command: 'run' })

  is(preset.command, 'run', 'stored preset command should be "run"')
  is(
    preset.configuration,
    '--dev --no-ask',
    'stored preset config should be "--dev --no-ask"'
  )

  const run = await Helper.run({ link })
  const result = await Helper.untilResult(run.pipe)
  const flags = JSON.parse(result)
  is(flags.dev, true, 'dev flag is set')
  is(flags.ask, false, 'no-ask flag is set')
  await Helper.untilClose(run.pipe)

  await presets({
    link,
    command: 'run',
    reset: true
  })

  preset = await presets({ link, command: 'run' })
  is(preset, null, 'initial run preset should be null after reset')

  async function presets({ link, command, configuration, reset }) {
    const presetStream = await helper.preset({
      link,
      command,
      configuration,
      reset
    })
    teardown(() => Helper.teardownStream(presetStream))
    const result = await Helper.pick(presetStream, { tag: 'preset' })
    return result.preset
  }
})
