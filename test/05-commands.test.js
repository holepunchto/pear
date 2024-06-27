'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fixture = path.join(Helper.root, 'test', 'fixtures', 'terminal')
const setup = new Helper()

test('commands setup', async ({ pass }) => {
  await setup.ready()
  pass('sidecar connected')
})

test('pear stage --json <channel> <dir>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)

  const argv = ['stage', '--json', 'test-' + testId, fixture]

  const running = await Helper.open(fixture, { tags: ['exit'] }, { lineout: true })

  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await running.inspector.close()
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'])
  const { code } = await running.until.exit
  is(code, 0)
})

test('commands teardown', async ({ pass }) => {
  await setup.shutdown()
  pass('sidecar stopped')
})
