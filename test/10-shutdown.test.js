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
const BIN = isWindows ? 'pear.exe' : 'pear'
const OUT = path.join('out', 'make', BIN)
const npm = isWindows ? 'npm.cmd' : 'npm'

const unhookShutdown = test.hook('shutdown setup', rig.setup)

test('lock released after shutdown', async function ({ pass, plan, exception, comment, teardown }) {
  plan(2)
  comment('shutting down sidecar')
  const helper = new Helper(rig)
  await helper.ready()

  const corestorePath = path.join(rig.platformDir, 'corestores', 'platform-next')

  await exception(async () => {
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
const unhookPlatform = test.hook('prepare low-spindown platform', async (t) => {
  t.timeout(120_000)

  platformDirLs = path.join(Helper.tmp, 'als-pear')
  t.comment(`Copying platform code to ${platformDirLs}`)
  await fs.promises.mkdir(platformDirLs, { recursive: true })
  const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(platformDirLs), {
    prune: false,
    ignore: ['/pear', '/.git', '/test', '/out']
  })
  await mirror.done()

  t.comment('Patching sidecar')
  const sidecarPath = path.join(platformDirLs, 'sidecar.js')
  const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
  const patch = `
  (() => { require('./constants.js').SPINDOWN_TIMEOUT = ${SPINDOWN_TIMEOUT} })()
  `
  const patchedSidecarCode = patch + sidecarCode
  fs.writeFileSync(sidecarPath, patchedSidecarCode)

  t.comment('Building low-spindown sidecar')
  const build = spawn(npm, ['run', `make`], {
    cwd: platformDirLs,
    stdio: 'ignore'
  })
  await new Promise((resolve) => build.once('exit', resolve))
})

test('sidecar should spindown after a period of inactivity', async (t) => {
  t.plan(1)
  t.timeout(SPINDOWN_TIMEOUT + 20_000)

  t.comment('Starting sidecar')
  const runtime = path.join(platformDirLs, Helper.OUT)
  const sidecar = spawn(runtime, ['sidecar'], {
    stdio: 'ignore',
    cwd: platformDirLs
  })
  t.teardown(() => {
    if (sidecar.exitCode === null) sidecar?.kill()
  })
  const untilExit = new Promise((resolve) =>
    sidecar.once('exit', (code, signal) => {
      resolve(signal ? 128 + signal : code)
    })
  )
  t.teardown(() => untilExit)

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

unhookPlatform('patched platform cleanup', async () => {
  await Helper.gc(platformDirLs)
})

test('sidecar should not spindown until ongoing update is finished', async (t) => {
  t.plan(2)
  t.timeout(120_000)

  t.comment('1. Prepare throttled seeder platform')
  let platformDirRcv
  {
    const patchedArtefactDir = path.join(Helper.tmp, 'arcv-pear')
    t.comment(`Copying platform code to ${patchedArtefactDir}`)
    await fs.promises.mkdir(patchedArtefactDir, { recursive: true })
    t.teardown(() => Helper.gc(patchedArtefactDir))
    const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(patchedArtefactDir), {
      prune: false,
      ignore: ['/pear', '/.git', '/test', '/out']
    })
    await mirror.done()

    t.comment('Patching sidecar to throttle seeding')
    const sidecarPath = path.join(patchedArtefactDir, 'sidecar.js')
    const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
    const patch = `
  (() => {
    const secretStream = require('@hyperswarm/secret-stream')
    const originalWrite = secretStream.prototype.write
    let allowedPackets = 20
    secretStream.prototype.write = function (data) {
      return allowedPackets-- > 0 ? originalWrite.call(this, data) : true
    }
  })()
  `
    const patchedSidecarCode = patch + sidecarCode
    fs.writeFileSync(sidecarPath, patchedSidecarCode)

    t.comment('Building throttled sidecar')
    const build = spawn(npm, ['run', `make`], {
      cwd: patchedArtefactDir,
      stdio: 'ignore'
    })
    await new Promise((resolve) => build.once('exit', resolve))

    platformDirRcv = path.join(patchedArtefactDir, 'pear')
  }

  t.comment('2. Start throttled seeder platform')
  t.comment('Starting throttled seeder platform')
  const rcvHelper = new Helper({ platformDir: platformDirRcv })
  t.teardown(
    async () => {
      await rcvHelper.shutdown()
      rcvHelper.close()
    },
    { order: Infinity }
  )
  await rcvHelper.ready()
  const rcvLink = await Helper.touchLink(rcvHelper)

  t.comment('3. Prepare updater platform')
  let buildDir
  {
    const artefactDir = path.join(Helper.tmp, 'rcv-pear')
    t.comment(`Copying platform code to ${artefactDir}`)
    await fs.promises.mkdir(artefactDir, { recursive: true })
    t.teardown(() => Helper.gc(artefactDir))
    const mirror = new LocalDrive(rig.artefactDir).mirror(new LocalDrive(artefactDir), {
      prune: false,
      ignore: ['/pear', '/.git', '/test', '/out']
    })
    await mirror.done()

    t.comment('Updating upgrade link and version to 1.0.0')
    const packageJsonFile = path.join(artefactDir, 'package.json')
    const packageJson = require(packageJsonFile)
    packageJson.upgrade = { production: rcvLink }
    packageJson.version = '1.0.0'
    await fs.promises.writeFile(packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf8')

    t.comment('Applying low spindown patch')
    const sidecarPath = path.join(artefactDir, 'sidecar.js')
    const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
    const patch = `
    (() => { require('./constants.js').SPINDOWN_TIMEOUT = ${SPINDOWN_TIMEOUT} })()
    `
    const patchedSidecarCode = patch + sidecarCode
    fs.writeFileSync(sidecarPath, patchedSidecarCode)

    t.comment('Building platform')
    const build = spawn(npm, ['run', `make`], {
      cwd: artefactDir,
      stdio: 'ignore'
    })
    await new Promise((resolve) => build.once('exit', resolve))

    t.comment('Copying build to build dir')
    buildDir = path.join(artefactDir, 'build')
    await fs.promises.mkdir(path.join(buildDir, path.dirname(OUT)), { recursive: true })
    t.teardown(() => {
      Helper.gc(artefactDir)
    })
    await fs.promises.cp(path.join(artefactDir, OUT), path.join(buildDir, OUT))

    t.comment('Copying build to app dir')
    await fs.promises.mkdir(path.join(buildDir, 'by-arch', HOST, 'app'), { recursive: true })
    t.teardown(() => {
      Helper.gc(artefactDir)
    })
    await fs.promises.cp(
      path.join(artefactDir, OUT),
      path.join(buildDir, 'by-arch', HOST, 'app', BIN)
    )

    t.comment('Staging as version 2.0.0')
    packageJson.version = '2.0.0'
    await fs.promises.writeFile(
      path.join(buildDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf8'
    )
  }

  t.comment('Staging platform using throttled platform')
  let peerAddedUntil = null
  {
    const stager = rcvHelper.stage({
      link: rcvLink,
      dir: buildDir,
      dryRun: false
    })
    const stagerUntil = await Helper.pick(stager, [{ tag: 'addendum' }, { tag: 'final' }])
    await stagerUntil.final

    t.comment('Seeding staged platform using throttled platform')
    const seeder = rcvHelper.seed({
      link: rcvLink,
      dir: rig.artefactDir,
      key: null,
      cmdArgs: []
    })
    const seederUntil = await Helper.pick(seeder, [{ tag: 'announced' }, { tag: 'peer-add' }])
    await seederUntil.announced
    peerAddedUntil = seederUntil['peer-add'].then(
      () => true,
      () => false
    )
    t.teardown(() => Helper.teardownStream(seeder))
  }

  t.comment('4. Start sidecar and update using the throttle seeder')
  t.comment('Starting sidecar')
  const dhtBootstrap = Helper.dhtBootstrap.map((e) => `${e.host}:${e.port}`).join(',')
  const sidecar = spawn(path.join(buildDir, OUT), ['sidecar', '--dhtBootstrap', dhtBootstrap], {
    stdio: 'ignore'
  })
  t.teardown(() => {
    if (sidecar.exitCode === null) sidecar?.kill()
  })
  const untilExit = new Promise((resolve) => sidecar.once('exit', resolve))
  t.teardown(() => untilExit, { order: Infinity })

  // Keep the updater sidecar alive until peer discovery completes.
  const sidecarClient = new Helper({
    platformDir: path.join(buildDir, 'pear'),
    expectSidecar: true
  })
  let sidecarClientClosed = false
  t.teardown(async () => {
    if (!sidecarClientClosed) await sidecarClient.close()
  })
  await sidecarClient.ready()
  // Complete an operation so closing the client starts a fresh spindown countdown.
  const touching = sidecarClient.touch({})
  await Helper.pick(touching, { tag: 'final' })

  t.comment('Waiting for updater to connect to throttled seeder')
  const peerAdded = await Promise.race([peerAddedUntil, untilExit.then(() => false)])
  t.is(peerAdded, true, 'sidecar successfully connected to throttled seeder')

  await sidecarClient.close()
  sidecarClientClosed = true

  if (!peerAdded) {
    t.fail('cannot test spindown before updater connects')
    return
  }

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

  if (hasSpunDown !== false) {
    t.fail('sidecar failed to prevent spindown during update')
  } else {
    t.pass('sidecar successfully blocked spindown during update')
  }
})

unhookShutdown('shutdown cleanup', rig.cleanup)
