const test = require('brittle')
const b4a = require('b4a')
const Helper = require('./helper')

test('pear info: link validation', async (t) => {
  t.plan(2)

  const links = [
    {},
    { id: 'invalid-link' },
    0,
    1,
    null,
    true,
    false,
    b4a.allocUnsafe(8)
  ]
  const expectedErrors = links.map(() => 'ERR_INVALID_LINK')

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const actualErrors = []
  for (const link of links) {
    const stream = helper.info({ link })
    try {
      await Helper.pick(stream, { tag: 'final' })
      actualErrors.push(null)
    } catch (e) {
      actualErrors.push(e.code)
    }
  }
  t.alike(actualErrors, expectedErrors, 'links validated')
  t.is(helper.closed, false)
})
