'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const Helper = require('./helper')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')
const LocalDrive = require('localdrive')
const Corestore = require('corestore')

const rig = new Helper.Rig({ keepAlive: false })

const SPINDOWN_TIMEOUT = 15_000

const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)

test.hook('shutdown setup', rig.setup)

test('lock released after shutdown', async function ({ pass, plan, exception, comment, teardown }) {
  plan(2)
  comment('shutting down sidecar')
  const helper = new Helper(rig)
  await helper.ready()

  const corestorePath = path.join(rig.platformDir, 'corestores', 'platform')

  exception(async () => {
    const corestore = new Corestore(corestorePath)
    await corestore.ready()
  }, 'platform corestore is locked')

  comment('sidecar shutdown')
  await helper.shutdown()

  const store = new Corestore(corestorePath, { wait: true })
  teardown(() => store.close())
  await store.ready()
  pass('platform corestore is free after platform shutdown')
})

let platformDirLs
test.hook('prepare low-spindown platform', async (t) => {
  t.timeout(120_000)

  const patchedArtefactDir = path.join(Helper.tmp, 'als-pear')
  t.comment(`Copying platform code to ${patchedArtefactDir}`)
  await fs.promises.mkdir(patchedArtefactDir, { recursive: true })
  t.teardown(() => Helper.gc(patchedArtefactDir))
  const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(patchedArtefactDir), {
    prune: false,
    ignore: ['/pear', '/.git', '/test']
  })
  await mirror.done()

  t.comment('Patching sidecar')
  const sidecarPath = path.join(patchedArtefactDir, 'sidecar.js')
  const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
  const patch = `
  (() => { require('pear-constants').SPINDOWN_TIMEOUT = ${SPINDOWN_TIMEOUT} })()
  `
  const patchedSidecarCode = patch + sidecarCode
  fs.writeFileSync(sidecarPath, patchedSidecarCode)

  t.comment('Staging patched platform')
  const rigHelper = new Helper(rig)
  t.teardown(() => rigHelper.close(), { order: Infinity })
  await rigHelper.ready()
  const patchedLink = await Helper.touchLink(rigHelper)

  const patchedStager = rigHelper.stage({
    link: patchedLink,
    dir: patchedArtefactDir,
    dryRun: false
  })
  const patchedStagerUntil = await Helper.pick(patchedStager, [{ tag: 'final' }])
  await patchedStagerUntil.final

  t.comment('Seeding patched platform')
  const patchedSeeder = rigHelper.seed({
    link: patchedLink,
    dir: patchedArtefactDir,
    key: null,
    cmdArgs: []
  })
  const patchedSeederUntil = await Helper.pick(patchedSeeder, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const patchedPlatformKey = await patchedSeederUntil.key
  await patchedSeederUntil.announced
  t.teardown(() => Helper.teardownStream(patchedSeeder))

  t.comment('Bootstrapping patched platform as ls')
  platformDirLs = path.join(Helper.tmp, 'ls-pear')
  await Helper.bootstrap(patchedPlatformKey, platformDirLs)

  await Helper.teardownStream(patchedSeeder)
  await rigHelper.close()
})

test('sidecar should spindown after a period of inactivity', async (t) => {
  t.plan(1)
  t.timeout(SPINDOWN_TIMEOUT + 20_000)

  t.comment('Starting sidecar')
  const sidecar = spawn(path.join(platformDirLs, 'current', BY_ARCH), ['sidecar'], {
    stdio: 'pipe'
  })
  t.teardown(() => {
    if (sidecar.exitCode === null) sidecar?.kill()
  })
  const untilExit = new Promise((resolve) => sidecar.once('exit', resolve))
  t.teardown(async () => untilExit)

  t.comment(`Waiting for sidecar to spindown (${SPINDOWN_TIMEOUT / 1000}s)`)
  const timeoutUntil = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), SPINDOWN_TIMEOUT + 10_000)
    untilExit.finally(() => {
      clearTimeout(timeout)
      resolve()
    })
  })

  const hasSpunDown = await Promise.race([untilExit, timeoutUntil])
  if (hasSpunDown === false) {
    t.fail('sidecar failed to spin down')
  } else {
    t.pass('sidecar has spun down')
  }
})

test('sidecar should not spindown until ongoing update is finished', async (t) => {
  t.plan(2)
  t.timeout(120_000)

  t.comment('1. Prepare throttled platform as rcv')
  const patchedArtefactDir = path.join(Helper.tmp, 'arcv-pear')
  t.comment(`Copying platform code to ${patchedArtefactDir}`)
  await fs.promises.mkdir(patchedArtefactDir, { recursive: true })
  t.teardown(() => Helper.gc(patchedArtefactDir))
  const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(patchedArtefactDir), {
    prune: false,
    ignore: ['/pear', '/.git', '/test']
  })
  await mirror.done()

  t.comment('Patching sidecar to throttle seeding')
  const sidecarPath = path.join(patchedArtefactDir, 'sidecar.js')
  const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
  const patch = `
  (() => {
    const secretStream = require('@hyperswarm/secret-stream')
    const originalWrite = secretStream.prototype.write
    let allowedPackets = 10
    secretStream.prototype.write = function (data) {
      return allowedPackets-- > 0 ? originalWrite.call(this, data) : true
    }
  })()
  `
  const patchedSidecarCode = patch + sidecarCode
  fs.writeFileSync(sidecarPath, patchedSidecarCode)

  t.comment('Staging patched platform')
  const rigHelper = new Helper(rig)
  t.teardown(() => rigHelper.close(), { order: Infinity })
  await rigHelper.ready()
  const patchedLink = await Helper.touchLink(rigHelper)

  const patchedStager = rigHelper.stage({
    link: patchedLink,
    dir: patchedArtefactDir,
    dryRun: false
  })
  const patchedStagerUntil = await Helper.pick(patchedStager, [{ tag: 'final' }])
  await patchedStagerUntil.final

  t.comment('Seeding patched platform')
  const patchedSeeder = rigHelper.seed({
    link: patchedLink,
    dir: patchedArtefactDir,
    key: null,
    cmdArgs: []
  })
  const patchedSeederUntil = await Helper.pick(patchedSeeder, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const patchedPlatformKey = await patchedSeederUntil.key
  await patchedSeederUntil.announced
  t.teardown(() => Helper.teardownStream(patchedSeeder))

  t.comment('Bootstrapping patched platform')
  const platformDirRcv = path.join(Helper.tmp, 'rcv-pear')
  await Helper.bootstrap(patchedPlatformKey, platformDirRcv)
  t.teardown(() => Helper.gc(platformDirRcv))

  await Helper.teardownStream(patchedSeeder)
  await rigHelper.close()

  t.comment('2. Start patched rcv platform')
  t.comment('Starting rcv platform')
  const rcvHelper = new Helper({ platformDir: platformDirRcv })
  t.teardown(() => rcvHelper.close(), { order: Infinity })
  await rcvHelper.ready()
  const rcvLink = await Helper.touchLink(rcvHelper)

  t.comment('Staging platform using rcv')
  const stager = rcvHelper.stage({
    link: rcvLink,
    dir: rig.artefactDir,
    dryRun: false
  })
  const stagerUntil = await Helper.pick(stager, [{ tag: 'addendum' }, { tag: 'final' }])
  const staged = await stagerUntil.addendum
  await stagerUntil.final

  t.comment('Seeding staged platform using rcv')
  const seeder = rcvHelper.seed({
    link: rcvLink,
    dir: rig.artefactDir,
    key: null,
    cmdArgs: []
  })
  const seederUntil = await Helper.pick(seeder, [{ tag: 'announced' }, { tag: 'peer-add' }])
  await seederUntil.announced
  let peerAdded = false
  seederUntil['peer-add'].then(() => {
    peerAdded = true
  })
  t.teardown(() => Helper.teardownStream(seeder))

  t.comment('3. Start sidecar and update using rcv-seeded key')
  t.comment('Starting sidecar')
  const dhtBootstrap = global.Pear.app.dht.bootstrap.map((e) => `${e.host}:${e.port}`).join(',')
  const sidecar = spawn(
    path.join(platformDirLs, 'current', BY_ARCH),
    ['--dht-bootstrap', dhtBootstrap, 'sidecar', '--key', staged.key],
    { stdio: 'pipe' }
  )
  t.teardown(() => {
    if (sidecar.exitCode === null) sidecar?.kill()
  })
  const untilExit = new Promise((resolve) => sidecar.once('exit', resolve))
  t.teardown(async () => untilExit, { order: Infinity })

  t.comment(
    `Waiting for sidecar spindown timeout to lapse (${(SPINDOWN_TIMEOUT + 10_000) / 1000}s)`
  )
  const timeoutUntil = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), SPINDOWN_TIMEOUT + 10_000)
    untilExit.finally(() => {
      clearTimeout(timeout)
      resolve()
    })
  })

  const hasSpunDown = await Promise.race([untilExit, timeoutUntil])
  t.is(peerAdded, true, 'sidecar successfully connected to paused seeder')

  if (hasSpunDown !== false) {
    t.fail('sidecar failed to prevent spindown during update')
  } else {
    t.pass('sidecar successfully blocked spindown during update')
  }
})

test.hook('patched platform cleanup', async () => {
  await Helper.gc(platformDirLs)
})

test.hook('shutdown cleanup', rig.cleanup)
