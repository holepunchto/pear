'use strict'
const test = require('brittle')
const path = require('bare-path')
const fs = require('bare-fs')
const hs = require('hypercore-sign')
const hypercoreid = require('hypercore-id-encoding')
const z32 = require('z32')
const tmp = require('test-tmp')
const Helper = require('./helper')

test('pear multisig link', async function ({ ok, plan, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const pwd1 = Helper.makePwd('signer1-link-password')
  const pwd2 = Helper.makePwd('signer2-link-password')
  const { publicKey: pub1 } = hs.generateKeys(pwd1)
  const { publicKey: pub2 } = hs.generateKeys(pwd2)
  const signers = [hypercoreid.encode(pub1), hypercoreid.encode(pub2)]

  const pkgDir = await tmp()
  teardown(() => fs.promises.rm(pkgDir, { recursive: true }))
  fs.mkdirSync(pkgDir, { recursive: true })
  const pkgPath = path.join(pkgDir, 'package.json')
  fs.writeFileSync(
    pkgPath,
    JSON.stringify({
      name: 'test-multisig',
      pear: { name: 'test-multisig', multisig: { signers, quorum: 2, namespace: 'test-ns-link' } }
    })
  )

  const multisig = helper.multisig({ action: 'link', package: pkgPath })
  teardown(() => Helper.teardownStream(multisig))
  const result = await Helper.pick(multisig, { tag: 'final' })

  ok(result.link, 'multisig link returned')
  ok(result.link.startsWith('pear://'), 'multisig link is a pear link')
})

test('pear multisig request', async function ({ ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const pwd1 = Helper.makePwd('signer1-req-password')
  const { publicKey: pub1 } = hs.generateKeys(pwd1)
  const signers = [hypercoreid.encode(pub1)]

  const pkgDir = await tmp()
  teardown(() => fs.promises.rm(pkgDir, { recursive: true }))
  fs.mkdirSync(pkgDir, { recursive: true })
  const pkgPath = path.join(pkgDir, 'package.json')
  fs.writeFileSync(
    pkgPath,
    JSON.stringify({
      name: 'test-multisig-req',
      pear: {
        name: 'test-multisig-req',
        multisig: { signers, quorum: 1, namespace: 'test-ns-req' }
      }
    })
  )

  comment('staging source app')
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({ link: stageLink, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { verlink } = await staged.addendum
  await staged.final

  comment('seeding source app')
  const seeding = helper.seed({
    link: stageLink,
    dir: Helper.fixture('minimal'),
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const seedUntil = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seedUntil.announced
  const key = await seedUntil.key

  comment('setting up external peers')
  await Helper.setupPeers(key, 2, teardown)

  comment('creating multisig request')
  const multisig = helper.multisig({
    action: 'request',
    package: pkgPath,
    verlink,
    peerUpdateTimeout: 30000
  })
  teardown(() => Helper.teardownStream(multisig))
  const result = await Helper.pick(multisig, { tag: 'final' })

  ok(result.request, 'multisig request returned')
  ok(
    typeof result.request === 'string' && result.request.length > 0,
    'request is a non-empty string'
  )
})

test('pear multisig commit', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const pwd1 = Helper.makePwd('signer1-commit-password')
  const pwd2 = Helper.makePwd('signer2-commit-password')
  const { publicKey: pub1, secretKey: sec1 } = hs.generateKeys(pwd1)
  const { publicKey: pub2, secretKey: sec2 } = hs.generateKeys(pwd2)
  const signers = [hypercoreid.encode(pub1), hypercoreid.encode(pub2)]

  const pkgDir = await tmp()
  teardown(() => fs.promises.rm(pkgDir, { recursive: true }))
  fs.mkdirSync(pkgDir, { recursive: true })
  const pkgPath = path.join(pkgDir, 'package.json')
  fs.writeFileSync(
    pkgPath,
    JSON.stringify({
      name: 'test-multisig-commit',
      pear: {
        name: 'test-multisig-commit',
        multisig: { signers, quorum: 2, namespace: 'test-ns-commit' }
      }
    })
  )

  comment('staging source app')
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({ link: stageLink, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { link, verlink } = await staged.addendum
  await staged.final

  comment('seeding source app')
  const seeding = helper.seed({
    link: stageLink,
    dir: Helper.fixture('minimal'),
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const seedUntil = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seedUntil.announced
  const key = await seedUntil.key

  comment('setting up external peers')
  await Helper.setupPeers(key, 2, teardown)

  comment('creating multisig request')
  const reqStream = helper.multisig({
    action: 'request',
    package: pkgPath,
    verlink,
    peerUpdateTimeout: 30000
  })
  teardown(() => Helper.teardownStream(reqStream))
  const { request } = await Helper.pick(reqStream, { tag: 'final' })

  comment('signing request')
  const requestBytes = z32.decode(request)
  const resp1 = hs.sign(requestBytes, sec1, Helper.makePwd('signer1-commit-password'))
  const resp2 = hs.sign(requestBytes, sec2, Helper.makePwd('signer2-commit-password'))
  const responses = [z32.encode(resp1), z32.encode(resp2)]

  comment('verifying (dry-run)')
  const verifyStream = helper.multisig({
    action: 'verify',
    package: pkgPath,
    link,
    request,
    responses,
    firstCommit: true,
    peerUpdateTimeout: 30000
  })
  teardown(() => Helper.teardownStream(verifyStream))
  const verified = await Helper.pick(verifyStream, { tag: 'final' })

  ok(verified.dryRun, 'verify is a dry-run')
  is(verified.quorum.amount, 2, 'quorum amount matches')

  comment('setting up destination peers')
  const dstDbKey = hypercoreid.decode(verified.dstKey)
  const dstBlobsKey = hypercoreid.decode(verified.result.blobs.destCore.key)
  await Helper.setupDestPeers(dstDbKey, dstBlobsKey, 2, teardown)

  comment('committing')
  const commitStream = helper.multisig({
    action: 'commit',
    package: pkgPath,
    link,
    request,
    responses,
    firstCommit: true,
    peerUpdateTimeout: 30000
  })
  teardown(() => Helper.teardownStream(commitStream))
  const committed = await Helper.pick(commitStream, { tag: 'final' })

  ok(committed.dstKey, 'committed drive has a destination key')
})
