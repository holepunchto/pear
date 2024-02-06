'use strict'
const path = require('path')
const test = require('brittle')
const Helper = require('./helper')
const { SWAP } = require('../lib/constants')
const download = require('../lib/download')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')

test('smoke', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(2)
  timeout(360000)

  const helper = new Helper(teardown)
  await helper.bootstrap()
  const dir = path.join(__dirname, 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('seeding')
  const key = await helper.pick(helper.seed({
    id: Math.floor(Math.random() * 10000),
    name: 'test',
    channel: 'test',
    key: null,
    dir,
    clientArgv: [
      'node',
      'pear',
      'seed',
      'test',
      '--name=test',
      '--swap',
      SWAP
    ]
  }, { close: false }), { tag: 'key' })

  ok(key, 'key is valid')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key],
    dev: true,
    key,
    dir
  }), [{ tag: 'ready' }, { tag: 'exit' }])

  await app.ready

  await helper.destroy()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})

test('smoke update', async function (t) {
  const { timeout, ok, is, teardown, comment } = t
  try {
    const osTmpDir = await fs.promises.realpath(os.tmpdir())
    const tmpPlatformDir = path.join(osTmpDir, 'tmp-platform')
    const tmpCodebaseDir = path.join(osTmpDir, 'tmp-codebse')

    const gc = async (dir) => await fs.promises.rm(dir, { recursive: true })

    try { await gc(tmpPlatformDir) } catch { }
    try { await gc(tmpCodebaseDir) } catch { }

    await fs.promises.mkdir(tmpPlatformDir, { recursive: true })
    await fs.promises.mkdir(tmpCodebaseDir, { recursive: true })

    teardown(() => gc(tmpPlatformDir), { order: Infinity })
    teardown(() => gc(tmpCodebaseDir), { order: Infinity })

    timeout(360000)

    const codebaseDir = path.join(__dirname, '..')
    const platDir0 = path.join(codebaseDir, 'pear')
    const swapDir0 = path.join(platDir0, 'current')

    const platDir1 = tmpPlatformDir
    const swapDir1 = path.join(platDir1, 'current')

    const helper = new Helper(teardown, { platformDir: platDir0, swap: swapDir0 })
    await helper.bootstrap()

    const dir = path.join(__dirname, 'fixtures', 'terminal')

    comment('staging app')
    await helper.sink(helper.stage({
      id: Math.floor(Math.random() * 10000),
      channel: 'test',
      name: 'test',
      key: null,
      dir,
      dryRun: false,
      bare: true,
      ignore: [],
      clientArgv: []
    }, { close: false }))

    comment('seeding app')
    const appKey = await helper.pick(helper.seed({
      id: Math.floor(Math.random() * 10000),
      name: 'test',
      channel: 'test',
      key: null,
      dir,
      clientArgv: [
        'node',
        'pear',
        'seed',
        'test',
        '--name=test',
        '--swap',
        SWAP
      ]
    }, { close: false }), { tag: 'key' })

    ok(appKey, 'key is ok')

    comment('mirroring and installing platform')
    const mirror = new Helper.Mirror(teardown, { src: codebaseDir, dest: tmpCodebaseDir })
    teardown(() => mirror.close())
    await mirror.ready()
    const drive = mirror.drive

    comment('staging')
    const addendum = await helper.pick(helper.stage({
      id: Math.floor(Math.random() * 10000),
      channel: 'test',
      name: 'pear',
      key: null,
      dir: drive.root,
      dryRun: false,
      bare: true,
      ignore: [],
      clientArgv: []
    }, { close: false }), { tag: 'addendum' })

    const v1 = addendum?.version
    ok(v1, 'stage version is ok')

    comment('seeding platform')
    const seed = helper.pickMany(helper.seed({
      id: Math.floor(Math.random() * 10000),
      channel: 'test',
      name: 'pear',
      key: null,
      dir: drive.root,
      clientArgv: [
        'node',
        'pear',
        'seed'
      ]
    }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

    const key = await seed.key
    const announced = await seed.announced

    ok(key, 'platform key is ok')
    ok(announced, 'seeding is announced')

    comment('provisioning dir folder, please wait')
    const p = new Helper.Provision(teardown, key, platDir1)
    teardown(() => p.close())
    await p.ready()
    await p.provision()
    await p.close()

    comment('downloading')
    await download(swapDir1, key)

    // align process.argv for 'prod'
    const idx = process.argv.indexOf('--swap')
    if (idx > -1) process.argv.splice(idx, 2)
    process.argv.push(`--platform-dir=${tmpPlatformDir}`, '--swap', swapDir1)
    helper.clearRequireCache()

    comment('sidecar')
    const sidecar = spawn(helper.terminalRuntime(swapDir1),
      [
        'pear',
        '--sidecar',
        `--platform-dir=${tmpPlatformDir}`
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe']
      })
    teardown(() => sidecar.kill('SIGKILL'))

    const platform = new Helper(teardown, { platformDir: tmpPlatformDir, swap: swapDir1 })
    await platform.bootstrap()

    comment('running')
    const app = platform.pickMany(platform.run({
      args: [appKey, `--platform-dir=${tmpPlatformDir}`],
      dev: true,
      key: appKey,
      dir: tmpPlatformDir
    }), [{ tag: 'ready' }, { tag: 'update' }, { tag: 'exit' }])

    await app.ready

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    await drive.put(`/${ts}.txt`, Buffer.from('..'))

    comment('restaging')
    const restage = await helper.pick(helper.stage({
      id: Math.floor(Math.random() * 10000),
      channel: 'test',
      name: 'pear',
      key: null,
      dir: drive.root,
      dryRun: false,
      bare: true,
      ignore: [],
      clientArgv: []
    }, { close: false }), { tag: 'addendum' })

    const v2 = restage?.version

    ok(v2, 'v2')
    ok(v2 > v1, 'v2 > v1')

    await helper.destroy()

    console.log('awaiting app.update')
    await app.update

    comment('restarting')
    await platform.restart([{ all: true }])

    await platform.destroy()

    const { code } = await app.exit
    is(code, 0, 'exit code is 0')
  } catch (e) {
    console.error(e)
    t.fail()
  }
})
