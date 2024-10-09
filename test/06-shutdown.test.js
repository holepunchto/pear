'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const fsext = require('fs-native-extensions')
const Helper = require('./helper')
const constants = require('../constants')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')
const LocalDrive = require('localdrive')

const rig = new Helper.Rig({ keepAlive: false })

const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)

test.hook('shutdown setup', rig.setup)

test('lock released after shutdown', async function ({ ok, plan, comment, teardown }) {
  plan(1)
  comment('shutting down sidecar')
  const helper = new Helper(rig)
  await helper.ready()
  await helper.shutdown()
  comment('sidecar shutdown')
  comment('checking file lock is free')
  const lock = path.join(rig.platformDir, 'corestores', 'platform', 'primary-key')
  const fd = fs.openSync(lock, 'r+')

  teardown(async () => {
    if (granted) fsext.unlock(fd)
    comment('closing file descriptor')
    fs.closeSync(fd)
    comment('file descriptor closed')
  })

  const granted = fsext.tryLock(fd)
  ok(granted, 'file lock is free')
})

test('sidecar should spindown after a period of inactivity', async (t) => {
  t.plan(1)
  t.timeout(constants.SPINDOWN_TIMEOUT + 60_000)

  t.comment('Starting sidecar')
  const sidecar = spawn(path.join(rig.platformDir, 'current', BY_ARCH), ['--sidecar', '--verbose'], { stdio: 'pipe' })
  t.teardown(() => { if (sidecar.exitCode === null) sidecar?.kill() })
  const onExit = new Promise(resolve => sidecar.once('exit', resolve))
  t.teardown(async () => onExit)

  t.comment('Waiting for sidecar to be ready')
  await new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Sidecar booted')) resolve() }))

  t.comment(`Waiting for sidecar to spindown (${constants.SPINDOWN_TIMEOUT / 1000}s)`)
  let timeoutObject
  let timeoutReject
  const timeout = new Promise((resolve, reject) => {
    timeoutReject = reject
    timeoutObject = setTimeout(() => resolve(false), constants.SPINDOWN_TIMEOUT + 30_000)
  })

  const hasSpunDown = await Promise.race([onExit, timeout])
  if (hasSpunDown === false) {
    t.fail('sidecar failed to spin down')
  } else {
    clearTimeout(timeoutObject)
    timeoutReject()
    t.pass('sidecar has spun down')
  }
})

test('sidecar should not spindown until ongoing update is finished', async (t) => {
  t.plan(4)
  t.timeout(constants.SPINDOWN_TIMEOUT * 2 + 180_000)

  const patchedArtefactDir = path.join(Helper.tmp, 'slo-pear')
  t.comment('1. Prepare patched platform that throttles seeding')
  t.comment(`\tCopying platform code to ${patchedArtefactDir}`)
  await fs.promises.mkdir(patchedArtefactDir, { recursive: true })
  t.teardown(() => Helper.gc(patchedArtefactDir))
  const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(patchedArtefactDir), {
    prune: false,
    filter: (key) => !(key.startsWith('/pear/') || key.startsWith('/.git/'))
  })
  // eslint-disable-next-line no-unused-vars
  for await (const val of mirror) { /* ignore */ }

  t.comment('\tPatching sidecar to throttle seeding')
  const sidecarPath = path.join(patchedArtefactDir, 'sidecar.js')
  const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
  const patch = `
  (() => {
    const env = require('bare-env')
    const secretStream = require('@hyperswarm/secret-stream')
    const originalWrite = secretStream.prototype.write
    let allowedPackets = 10
    secretStream.prototype.write = function (data) {
      return env.UNPAUSED !== undefined || allowedPackets-- > 0 ? originalWrite.call(this, data) : true
    }
  })()
  `
  const patchedSidecarCode = patch + sidecarCode
  fs.writeFileSync(sidecarPath, patchedSidecarCode)

  t.comment('\tStaging patched platform')
  const rigHelper = new Helper(rig)
  t.teardown(() => rigHelper.close(), { order: Infinity })
  await rigHelper.ready()

  const patchedStager = rigHelper.stage({ channel: 'test-spindown-patched', name: 'test-spindown-patched', dir: patchedArtefactDir, dryRun: false, bare: true })
  const patchedStagerUntil = await Helper.pick(patchedStager, [{ tag: 'final' }])
  await patchedStagerUntil.final

  t.comment('\tSeeding patched platform')
  const patchedSeeder = rigHelper.seed({ channel: 'test-spindown-patched', name: 'test-spindown-patched', dir: patchedArtefactDir, key: null, cmdArgs: [] })
  const patchedSeederUntil = await Helper.pick(patchedSeeder, [{ tag: 'key' }, { tag: 'announced' }])
  const patchedPlatformKey = await patchedSeederUntil.key
  await patchedSeederUntil.announced
  t.teardown(() => Helper.teardownStream(patchedSeeder))

  t.comment('\tBootstrapping patched platform as rcv')
  const platformDirRcv = path.join(Helper.tmp, 'rcv-pear')
  await Helper.bootstrap(patchedPlatformKey, platformDirRcv)
  t.teardown(() => Helper.gc(platformDirRcv))

  await Helper.teardownStream(patchedSeeder)

  t.comment('\tShutting down rig sidecar')
  await rigHelper.shutdown()
  await rigHelper.close()

  t.comment('2. Start patched rcv platform')
  t.comment('\tStarting rcv platform')
  const rcvHelper = new Helper({ platformDir: platformDirRcv })
  t.teardown(() => rcvHelper.close(), { order: Infinity })
  await rcvHelper.ready()

  t.comment('\tStaging platform using rcv')
  const stager = rcvHelper.stage({ channel: 'test-spindown', name: 'test-spindown', dir: rig.artefactDir, dryRun: false, bare: true })
  const stagerUntil = await Helper.pick(stager, [{ tag: 'addendum' }, { tag: 'final' }])
  const staged = await stagerUntil.addendum
  await stagerUntil.final

  t.comment('\tSeeding staged platform using rcv')
  const seeder = rcvHelper.seed({ channel: 'test-spindown', name: 'test-spindown', dir: rig.artefactDir, key: null, cmdArgs: [] })
  const seederUntil = await Helper.pick(seeder, [{ tag: 'announced' }, { tag: 'peer-add' }])
  await seederUntil.announced
  let peerAdded = false
  seederUntil['peer-add'].then(() => { peerAdded = true })
  t.teardown(() => Helper.teardownStream(seeder))

  t.comment('3. Start sidecar and update using rcv-seeded key')
  t.comment('\tStarting sidecar')
  const dhtBootstrap = global.Pear.config.dhtBootstrap.map(e => `${e.host}:${e.port}`).join(',')
  const sidecar = spawn(path.join(rig.platformDir, 'current', BY_ARCH), ['--sidecar', '--verbose', '--key', staged.key, '--dht-bootstrap', dhtBootstrap], { stdio: 'pipe' })
  t.teardown(() => { if (sidecar.exitCode === null) sidecar?.kill() })
  const onExit = new Promise(resolve => sidecar.once('exit', resolve))
  t.teardown(async () => onExit, { order: Infinity })

  const sidecarUpdated = new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Applied update')) resolve() }))

  t.comment('\tWaiting for sidecar to be ready')
  await new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Sidecar booted')) resolve() }))

  t.comment(`\tWaiting for sidecar spindown timeout to lapse (${(constants.SPINDOWN_TIMEOUT + 10_000) / 1000}s)`)
  let timeoutObject
  let timeoutReject
  const timeout = new Promise((resolve, reject) => {
    timeoutReject = reject
    timeoutObject = setTimeout(() => resolve(false), constants.SPINDOWN_TIMEOUT + 10_000)
  })

  const hasSpunDown = await Promise.race([onExit, timeout])
  t.is(peerAdded, true, 'sidecar successfully connected to paused seeder')

  if (hasSpunDown !== false) {
    clearTimeout(timeoutObject)
    timeoutReject()
    t.fail('sidecar failed to prevent spindown during update')
    return
  }

  t.pass('sidecar successfully blocked spindown during update')

  t.comment('4. Finish update using unpaused rcv platform')
  t.comment('\tShutting down rcv sidecar')
  await Helper.teardownStream(seeder)
  await rcvHelper.shutdown()
  await rcvHelper.close()

  t.comment('\tStarting unpaused rcv sidecar to finish update')
  const rcvHelperUnpaused = new Helper({ platformDir: platformDirRcv, env: { UNPAUSED: '1' } })
  await rcvHelperUnpaused.ready()

  t.comment('\tSeeding using unpaused rcv platform')
  const seederUnpaused = rcvHelperUnpaused.seed({ channel: 'test-spindown', name: 'test-spindown', dir: rig.artefactDir, key: null, cmdArgs: [] })
  const seederUntilUnpaused = await Helper.pick(seederUnpaused, [{ tag: 'announced' }, { tag: 'peer-add' }])
  await seederUntilUnpaused.announced
  t.teardown(() => Helper.teardownStream(seederUnpaused))
  t.teardown(() => rcvHelperUnpaused.close(), { order: Infinity })

  t.comment('\tWaiting for sidecar to finish update')
  await t.execution(sidecarUpdated, 'sidecar should successfully update')

  t.comment('\tWaiting for sidecar to close')
  const exitCode = await onExit

  t.is(exitCode, 0, 'exit code is 0')
})

test.hook('shutdown cleanup', rig.cleanup)
