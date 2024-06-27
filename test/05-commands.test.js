'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const { pathname } = new URL(global.Pear.config.applink)
const fixture = path.join(pathname, 'test', 'fixtures', 'terminal')

test('pear stage --json <channel> <dir>', async function ({ plan, comment, alike, is, teardown, timeout, execution }) {
  plan(2)

  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  })
  const testId = Math.floor(Math.random() * 100000)

  const argv = ['stage', '--json', 'test-' + testId, fixture]

  const running = await Helper.open(fixture, { tags: ['exit'] }, { lineout: true })

  await running.inspector.evaluate(`
    __PEAR_TEST__.ipc = new __PEAR_TEST__.Helper()
    __PEAR_TEST__.cmd(__PEAR_TEST__.ipc, ${JSON.stringify(argv)})
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
