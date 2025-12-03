const test = require('brittle')
const b4a = require('b4a')

const Helper = require('./helper')
const { ERR_INVALID_LINK } = require('pear-errors')

const opMethods = [
  'data',
  'drop',
  'dump',
  'gc',
  'info',
  'release',
  'run',
  'seed',
  'shift',
  'stage',
  'touch'
]

const testOp = async ({ t, link, helper, method, checkError } = opts) => {
  const stream = helper[method]({ link })
  try {
    await Helper.pick(stream, { tag: 'final' })
    t.fail('expected op to fail (op passed)')
  } catch (e) {
    if (checkError(e)) {
      t.pass()
    } else {
      t.fail(`op failed with unexepcted error: ${e}`)
    }
  }
}

test('running ops with invalid link param type does not crash the sidecar', async (t) => {
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
  t.plan(opMethods.length * links.length * 2)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const checkError = (e) => e.code === ERR_INVALID_LINK.name

  for (const method of opMethods) {
    for (const link of links) {
      t.comment(`calling "${method}" with link set to ${JSON.stringify(link)}`)
      await testOp({ t, link, helper, method, checkError })
      t.comment(`calling "${method}" again (testing sidecar not crashed)`)
      await testOp({ t, link, helper, method, checkError })
    }
  }
})
