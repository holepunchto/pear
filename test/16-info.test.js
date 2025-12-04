const test = require('brittle')
const b4a = require('b4a')
const { ERR_INVALID_LINK } = require('pear-errors')
const Helper = require('./helper')

test('pear info: invalid links do not crash the sidecar', async (t) => {
  t.plan(2)

  const invalidLinksAndExpectedError = [
    [{}, ERR_INVALID_LINK],
    [{ id: 'invalid-link' }, ERR_INVALID_LINK],
    [0, ERR_INVALID_LINK],
    [1, ERR_INVALID_LINK],
    [null, ERR_INVALID_LINK],
    [true, ERR_INVALID_LINK],
    [false, ERR_INVALID_LINK],
    [b4a.allocUnsafe(8), ERR_INVALID_LINK]
  ]
  const links = invalidLinksAndExpectedError.map((i) => i[0])
  const expectedErrorCodes = invalidLinksAndExpectedError.map((i) => i[1].name)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const actualErrorCodes = []
  for (const link of links) {
    const stream = helper.info({ link })
    try {
      await Helper.pick(stream, { tag: 'final' })
      actualErrorCodes.push(null)
    } catch (e) {
      actualErrorCodes.push(e.code)
    }
  }
  t.alike(actualErrorCodes, expectedErrorCodes)
  t.comment('sidecar does not crash')
  t.is(helper.closed, false)
})
