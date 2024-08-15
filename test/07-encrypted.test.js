'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const Helper = require('./helper')
const os = require('bare-os')
const fs = require('bare-fs')
const tmp = fs.realpathSync(os.tmpdir())
const encrypted = path.join(Helper.root, 'test', 'fixtures', 'encrypted')

class Rig {
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    const helper = new Helper()
    this.helper = helper
    comment('connecting local sidecar')
    await helper.ready()
    comment('local sidecar connected')
    const id = Math.floor(Math.random() * 10000)
    comment('staging platform...')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, dryRun: false, bare: true })
    await Helper.pick(staging, { tag: 'final' })
    comment('platform staged')
    comment('seeding platform...')
    const seeding = await helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, key: null, cmdArgs: [] })
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const key = await until.key
    this.key = key
    await until.announced
    comment('platform seeding')
    comment('bootstrapping tmp platform...')
    const platformDir = path.join(tmp, 'tmp-pear')
    this.platformDir = platformDir
    await Helper.bootstrap(key, platformDir)
    comment('tmp platform bootstrapped')
    const bootstrapped = new Helper({ platformDir: this.platformDir })
    this.bootstrapped = bootstrapped
    comment('connecting tmp sidecar...')
    await bootstrapped.ready()
    comment('tmp sidecar connected')
    global.Pear.teardown(async () => Helper.gc(platformDir))
  }

  cleanup = async ({ comment }) => {
    comment('shutting down bootstrapped sidecar')
    await this.bootstrapped.shutdown()
    comment('bootstrapped sidecar shutdown')
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shutdown')
  }
}

const rig = new Rig()

test('encrypted test setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)
  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  })

  const { platformDir } = rig
  const helper = new Helper({ platformDir })
  await helper.ready()
  const dir = encrypted

  const id = Math.floor(Math.random() * 10000)

  comment('add encryption key')
  const name = 'test-encryption-key'
  const secret = hypercoreid.encode(crypto.randomBytes(32))
  const addEncryptionKey = helper.encryptionKey({ action: 'add', name, secret })
  const encryptionKey = await Helper.pick(addEncryptionKey, { tag: 'added' })
  is(encryptionKey.name, name)

  comment('staging throws without encryption key')
  const stagingA = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const error = await Helper.pick(stagingA, { tag: 'error' })
  is(error.code, 'ERR_ENCRYPTION_KEY_REQUIRED')

  comment('staging with encryption key')
  const stagingB = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, encryptionKey: name, bare: true })
  const final = await Helper.pick(stagingB, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding encrypted app')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const appKey = await until.key
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  comment('run encrypted pear application')
  const link = 'pear://' + appKey
  const running = await Helper.open(link, { tags: ['exit'] }, { platformDir, encryptionKey: secret })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })

  is(value?.app?.key, appKey, 'app version matches staged key')

  await running.inspector.evaluate('disableInspector()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('encrypted test cleanup', rig.cleanup)
