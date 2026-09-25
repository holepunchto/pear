'use strict'
const test = require('brittle')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { isWindows } = require('which-runtime')

const root = path.resolve(__dirname, '..', '..')
const bin = path.join(root, 'out', 'make', isWindows ? 'pear.exe' : 'pear')

test('standalone touch', async (t) => {
  t.teardown(() => run(['sidecar', 'shutdown']))

  t.is(await run(['touch']), 0, 'touch no args')
  t.is(await run(['touch', '--vanity', 'pear'], 'inherit'), 0, 'touch with vanity')
})

function run(args, stdio = 'ignore') {
  const child = spawn(bin, args, { cwd: root, stdio })
  return new Promise((resolve) => child.once('exit', resolve))
}
