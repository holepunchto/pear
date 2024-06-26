'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const { pathname } = new URL(global.Pear.config.applink)
const fixture = path.join(pathname, 'test', 'fixtures', 'terminal')

test.todo('.....')

test('pear stage --json <channel> <dir>', async function ({ plan, comment, is, teardown, timeout, execution }) {
  // plan(7)
  timeout(180000)

  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  })
  const testId = Math.floor(Math.random() * 100000)

  const { pathname } = new URL(global.Pear.config.applink)

  const argv = ['stage', '--json', 'test-' + testId, path.join(pathname, 'test', 'fixtures', 'terminal')]

  const ondata = async (data) => {
    console.log('cool', data)
    let result = null
    execution(() => { result = JSON.parse(data) })
    if (result.tag === 'complete') await running.inspector.evaluate('__PEAR_TEST__.ipc.close()')
    // TODO: newline delimited json parsing, ensure each line parses without error,
    // when tag === complete running.inspector.evaluate(`__PEAR_TEST__.ipc.close()`)
  }
  const running = await Helper.open(fixture, { tags: ['exit'] }, { ondata })

  await running.inspector.evaluate(`
    __PEAR_TEST__.cmd(new __PEAR_TEST__.Helper(), ${JSON.stringify(argv)})
  `, { returnByValue: false })

  const { code } = await running.until.exit
  is(code, 0)
})
