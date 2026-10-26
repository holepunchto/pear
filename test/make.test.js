'use strict'
const test = require('brittle')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { spawnSync } = require('bare-subprocess')

const Helper = require('./helper')

test('pear make', async function ({ ok, plan, teardown, tmp }) {
  plan(9)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const dir = await tmp()
  teardown(() => fs.rmSync(dir, { recursive: true, force: true }))

  const entry = path.join(dir, 'entry.js').replace(/\\/g, '/')
  const pathDir = path.join(dir, 'out')

  fs.writeFileSync(entry, 'console.log("hello")')

  for (const host of [
    'win32-arm64',
    'win32-x64',
    'darwin-arm64',
    'darwin-x64',
    'linux-arm64',
    'linux-x64'
  ]) {
    const make = await helper.make({
      entrypoint: entry,
      host,
      pathDir: path.join(pathDir, host)
    })
    teardown(() => Helper.teardownStream(make))
    const made = await Helper.pick(make, [{ tag: 'final' }])
    await made.final

    const executable = path.join(
      pathDir,
      host,
      'app' + (['win32-arm64', 'win32-x64'].includes(host) ? '.exe' : '')
    )
    ok(fs.existsSync(executable), `${host} executable exists`)
  }

  const currentHost = `${os.platform()}-${os.arch()}`
  const executable = path.join(
    pathDir,
    currentHost,
    'app' + (os.platform() === 'win32' ? '.exe' : '')
  )
  const result = spawnSync(executable, [], {
    stdio: ['ignore', 'pipe', 'pipe']
  })
  ok(result.error === undefined, 'executable starts successfully')
  ok(result.status === 0, 'executable exits successfully')
  ok(result.stdout.toString().trim() === 'hello', 'prints expected output')
})
