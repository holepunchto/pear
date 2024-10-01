'use strict'
const test = require('brittle')
const path = require('bare-path')
const fs = require('bare-fs')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const constants = require('../constants')
const { isWindows, platform, arch } = require('which-runtime')
const { spawn } = require('bare-subprocess')
const Rache = require('rache')
const Corestore = require('corestore')
const Iambus = require('iambus')
const Hyperdrive = require('hyperdrive')
const Replicator = require('../subsystems/sidecar/lib/replicator')
const Hyperswarm = require('hyperswarm')
const ReadyResource = require('ready-resource')
const os = require('bare-os')

const TMP = fs.realpathSync(os.tmpdir())
const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)

const rig = new Helper.Rig()

function startSidecar (opts = {}) {
  const verbose = global.Pear.config.args.includes('--verbose')
  const platformDir = opts.platformDir || constants.PLATFORM_DIR
  const runtime = path.join(platformDir, 'current', BY_ARCH)
  const args = ['--sidecar', '--verbose', ...opts.args || []]

  return spawn(runtime, args, { detached: !verbose, stdio: 'pipe' })
}

class SlowSeeder extends ReadyResource {
  constructor (rawKey, corestoreDir) {
    super()

    this.key = hypercoreid.normalize(hypercoreid.decode(rawKey))
    this.corestoreDir = corestoreDir

    this.globalCache = new Rache({ maxSize: 65536 })
    this.bus = new Iambus()
    this.log = msg => this.bus.pub({ topic: 'seed', msg })
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
      // add increasing delay to writes to let the first few writes through (triggering update on client) then slowing down
      const originalWrite = connection.write
      let delay = 0
      connection.write = function (...args) {
        setTimeout(() => originalWrite.call(connection, ...args), delay)
        delay += 100
        return true
      }
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

test.hook('spindown setup', rig.setup)

test.hook('stage platform using primary rig', async ({ comment }) => {
  comment('staging platform using primary rig...')
  const staging = rig.artifact.stage({ channel: 'test-spindown', name: 'test-spindown', dir: rig.artifactDir, dryRun: false, bare: true })
  const until = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  rig.staged = await until.addendum
  await until.final
  comment('platform staged using primary rig')
})

test.hook('bootstrap secondary rig', async ({ comment }) => {
  rig.platformDir2 = path.join(TMP, 'rig-spindown')
  await Helper.bootstrap(rig.key, rig.platformDir2)
})

test.hook('shutdown primary rig', rig.cleanup)

test('sidecar should spindown after a period of inactivity', async (t) => {
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

test('sidecar should not spindown when there is an ongoing update', async (t) => {
  t.timeout(constants.SPINDOWN_TIMEOUT + 60_000)

  t.comment('Starting slow seeder')
  const seeder = new SlowSeeder(rig.staged.link, path.join(rig.platformDir, 'corestores', 'platform'))
  await seeder.ready()
  t.teardown(async () => seeder.close())

  t.comment(`Starting sidecar at ${rig.platformDir2}`)
  const sidecar = startSidecar({ platformDir: rig.platformDir2, args: ['--key', rig.staged.key] })
  t.teardown(() => { if (sidecar.exitCode === null) sidecar?.kill() })
  const onExit = new Promise(resolve => sidecar.once('exit', resolve))
  t.teardown(async () => onExit)

  t.comment('Waiting for sidecar to be ready')
  await new Promise(resolve => sidecar.stdout.on('data', (data) => { if (data.toString().includes('Sidecar booted')) resolve() }))

  t.comment(`Waiting for sidecar spindown timeout to lapse (${(constants.SPINDOWN_TIMEOUT + 30_000) / 1000}s)`)
  let timeoutObject
  let timeoutReject
  const timeout = new Promise((resolve, reject) => {
    timeoutReject = reject
    timeoutObject = setTimeout(() => resolve(false), constants.SPINDOWN_TIMEOUT + 30_000)
  })

  const hasSpunDown = await Promise.race([onExit, timeout])
  if (hasSpunDown === false) {
    t.pass('sidecar successfully blocked spindown during update')
  } else {
    clearTimeout(timeoutObject)
    timeoutReject()
    t.fail('sidecar failed to prevent spindown during update')
  }
})
