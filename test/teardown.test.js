/* global Pear */
const { teardown } = Pear
const test = require('brittle')

test('tesardown', async function(t) {
  teardown(() => console.log('hey'))
  t.pass()
})
