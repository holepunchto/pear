'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const fsext = require('fs-native-extensions')
const Helper = require('./helper')
const constants = require('../constants')
const { spawn } = require('bare-subprocess')
const ReadyResource = require('ready-resource')
const hypercoreid = require('hypercore-id-encoding')
const Rache = require('rache')
const Iambus = require('iambus')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Replicator = require('../subsystems/sidecar/lib/replicator')
const Hyperswarm = require('hyperswarm')
const os = require('bare-os')
const { platform, arch, isWindows } = require('which-runtime')

const rig = new Helper.Rig({ keepAlive: false })

const TMP = fs.realpathSync(os.tmpdir())
const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)

test.hook('shutdown setup', rig.setup)

function startSidecar (opts = {}) {
  const verbose = global.Pear.config.args.includes('--verbose')
  const platformDir = opts.platformDir || constants.PLATFORM_DIR
  const runtime = path.join(platformDir, 'current', BY_ARCH)
  const args = ['--sidecar', '--verbose', ...opts.args || []]

  return spawn(runtime, args, { detached: !verbose, stdio: 'pipe' })
}

class Seeder extends ReadyResource {
  constructor (rawKey, corestoreDir, paused = true) {
    super()

    this.key = hypercoreid.normalize(hypercoreid.decode(rawKey))
    this.corestoreDir = corestoreDir

    this.globalCache = new Rache({ maxSize: 65536 })
    this.bus = new Iambus()
    this.log = msg => this.bus.pub({ topic: 'seed', msg })

    this.paused = paused
    this.allowedPacketCount = 10
  }

  async _open () {
    this.corestore = new Corestore(this.corestoreDir, { globalCache: this.globalCache, manifestVersion: 1, compat: false })
    await this.corestore.ready()

    this.drive = new Hyperdrive(this.corestore, this.key)
    await this.drive.ready()

    this.replicator = new Replicator(this.drive)
    this.replicator.on('announce', () => this.log({ tag: 'announced' }))
    this.drive.core.on('peer-add', (peer) => this.log({ tag: 'peer-add', data: peer.remotePublicKey.toString('hex') }))
    this.drive.core.on('peer-remove', (peer) => this.log({ tag: 'peer-remove', data: peer.remotePublicKey.toString('hex') }))

    const keyPair = await this.corestore.createKeyPair('holepunch')
    this.swarm = new Hyperswarm({ keyPair })
    const corestore = this.corestore
    this.swarm.on('connection', (connection) => {
      // If paused, send initial (metadata) packets right away then stop sending as it starts sending data packets
      // this is to trigger the start of the update in client sidecars without actually completing the update
      const originalWrite = connection.write
      let allowedPacketCount = this.allowedPacketCount
      connection.write = (...args) =>
        !this.paused || allowedPacketCount-- > 0
          ? originalWrite.call(connection, ...args)
          : true

      corestore.replicate(connection)
    })

    await this.replicator.join(this.swarm, { announceSeeds: null, server: true, client: false })
  }

  async _close () {
    await this.replicator?.leave(this.swarm)
    await this.swarm?.destroy()
    await this.corestore?.close()
    await this.drive?.close()
  }
}

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

test.hook('stage platform using primary rig', async ({ timeout }) => {
  timeout(60_000)
  const helper = new Helper(rig)
  await helper.ready()

  const staging = helper.stage({ channel: 'test-spindown', name: 'test-spindown', dir: rig.artifactDir, dryRun: false, bare: true })
  const until = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  rig.staged = await until.addendum
  await until.final

  await helper.close()
})

test.hook('bootstrap secondary rig', async ({ timeout }) => {
  timeout(180_000)
  rig.platformDir2 = path.join(TMP, 'rig-sd')
  await Helper.bootstrap(rig.key, rig.platformDir2)
})

test.hook('shutdown primary rig', rig.cleanup)

test.skip('sidecar should spindown after a period of inactivity', async (t) => {
  t.plan(1)
  t.timeout(constants.SPINDOWN_TIMEOUT + 60_000)

  t.comment('Starting sidecar (primary rig)')
  const sidecar = startSidecar(rig)
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
  t.timeout(constants.SPINDOWN_TIMEOUT * 2 + 60_000)

  t.comment('Starting paused seeder')
  const link = rig.staged.link
  const corestoreDir = path.join(rig.platformDir, 'corestores', 'platform')
  const seeder = new Seeder(link, corestoreDir)
  await seeder.ready()
  t.teardown(async () => seeder.close())

  let peerAdded = false
  seeder.bus.sub({ topic: 'seed', msg: { tag: 'peer-add' } }).once('data', () => { peerAdded = true })

  t.comment(`Starting sidecar at ${rig.platformDir2}`)
  const sidecar = startSidecar({ platformDir: rig.platformDir2, args: ['--key', rig.staged.key] })
  t.teardown(() => { if (sidecar.exitCode === null) sidecar?.kill() })
  const onExit = new Promise(resolve => sidecar.once('exit', resolve))
  t.teardown(async () => onExit)

  const sidecarUpdated = new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Applied update')) resolve() }))

  t.comment('Waiting for sidecar to be ready')
  await new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Sidecar booted')) resolve() }))

  t.comment(`Waiting for sidecar spindown timeout to lapse (${(constants.SPINDOWN_TIMEOUT + 10_000) / 1000}s)`)
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

  t.comment('Closing paused seeder')
  await seeder.close()

  t.comment('Creating unpaused seeder to finish the update')
  const newSeeder = new Seeder(link, corestoreDir, false)
  await newSeeder.ready()
  t.teardown(async () => newSeeder.close())

  t.comment('Waiting for sidecar to update')
  await t.execution(sidecarUpdated, 'sidecar should successfully update')

  t.comment('Waiting for sidecar to close')
  const exitCode = await onExit

  t.is(exitCode, 0, 'exit code is 0')
})
