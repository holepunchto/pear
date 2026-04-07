'use strict'
const env = require('bare-env')
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const hs = require('hypercore-sign')
const z32 = require('z32')
const Helper = require('./helper')

const TEST_TIMEOUT = env.CI ? 120000 : 60000

test('pear info on unseeded key shows empty', async ({ ok, comment, teardown }) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const randomKey = hypercoreid.encode(Buffer.alloc(32, 0xab))
  const link = `pear://${randomKey}`

  comment('pear info unseeded link')
  const infoStream = helper.info({ link, cmdArgs: [] })
  teardown(() => Helper.teardownStream(infoStream))

  const until = await Helper.pick(infoStream, [{ tag: 'empty' }, { tag: 'final' }])

  const empty = await until.empty
  ok(empty, 'empty tag pushed for unseeded key')

  const final = await until.final
  ok(final, 'stream completed with final tag')
})

test('pear info seeded link returns info', async ({ ok, is, comment, teardown, timeout }) => {
  timeout(TEST_TIMEOUT)
  const dir = Helper.fixture('hello-world')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const link = await Helper.touchLink(helper)
  comment('staging source app')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')
  comment('seeding source app')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const seeded = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await seeded.announced

  const info = helper.info({ link, cmdArgs: [] })
  teardown(() => Helper.teardownStream(info))

  const until = await Helper.pick(info, [{ tag: 'info' }, { tag: 'final' }])
  is((await until.info).link, link)
})

test('pear info on committed multisig link includes multisig by default', async ({
  ok,
  is,
  comment,
  teardown,
  timeout
}) => {
  timeout(TEST_TIMEOUT)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const pwd1 = Helper.makePwd('info-signer1-password')
  const pwd2 = Helper.makePwd('info-signer2-password')
  const { publicKey: pub1, secretKey: sec1 } = hs.generateKeys(pwd1)
  const { publicKey: pub2, secretKey: sec2 } = hs.generateKeys(pwd2)
  const publicKeys = [hypercoreid.encode(pub1), hypercoreid.encode(pub2)]

  comment('staging source app')
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({ link: stageLink, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { link: srcLink, verlink } = await staged.addendum
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

  comment('creating multisig request')
  const reqStream = helper.multisig({
    action: 'request',
    publicKeys,
    quorum: 2,
    namespace: 'info-test-ns',
    verlink,
    force: true
  })
  teardown(() => Helper.teardownStream(reqStream))
  const { request } = await Helper.pick(reqStream, { tag: 'final' })

  comment('signing request')
  const requestBytes = z32.decode(request)
  const resp1 = hs.sign(requestBytes, sec1, Helper.makePwd('info-signer1-password'))
  const resp2 = hs.sign(requestBytes, sec2, Helper.makePwd('info-signer2-password'))
  const responses = [z32.encode(resp1), z32.encode(resp2)]

  comment('getting multisig link')
  const linkStream = helper.multisig({
    action: 'link',
    publicKeys,
    quorum: 2,
    namespace: 'info-test-ns'
  })
  teardown(() => Helper.teardownStream(linkStream))
  const { link: multisigLink } = await Helper.pick(linkStream, { tag: 'final' })

  comment('committing')
  const commitStream = helper.multisig({
    action: 'commit',
    publicKeys,
    quorum: 2,
    namespace: 'info-test-ns',
    link: srcLink,
    request,
    responses,
    forceDangerous: true
  })
  teardown(() => Helper.teardownStream(commitStream))
  await Helper.pick(commitStream, { tag: 'final' })

  comment('pear info on multisig link')
  const infoStream = helper.info({ link: multisigLink, cmdArgs: [] })
  teardown(() => Helper.teardownStream(infoStream))
  const until = await Helper.pick(infoStream, [{ tag: 'multisig' }, { tag: 'final' }])
  const multisig = await until.multisig
  is(multisig.quorum, 2, 'quorum is 2')
  is(multisig.publicKeys.length, 2, 'two public keys')
  ok(multisig.publicKeys.includes(hypercoreid.encode(pub1)), 'pub1 present')
  ok(multisig.publicKeys.includes(hypercoreid.encode(pub2)), 'pub2 present')
})

test('pear info --multisig on committed multisig link shows only multisig', async ({
  is,
  absent,
  comment,
  teardown,
  timeout
}) => {
  timeout(TEST_TIMEOUT)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const pwd1 = Helper.makePwd('info-flag-signer1-password')
  const pwd2 = Helper.makePwd('info-flag-signer2-password')
  const { publicKey: pub1, secretKey: sec1 } = hs.generateKeys(pwd1)
  const { publicKey: pub2, secretKey: sec2 } = hs.generateKeys(pwd2)
  const publicKeys = [hypercoreid.encode(pub1), hypercoreid.encode(pub2)]

  comment('staging source app')
  const stageLink = await Helper.touchLink(helper)
  const staging = helper.stage({ link: stageLink, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { link: srcLink, verlink } = await staged.addendum
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

  comment('creating multisig request')
  const reqStream = helper.multisig({
    action: 'request',
    publicKeys,
    quorum: 2,
    namespace: 'info-flag-test-ns',
    verlink,
    force: true
  })
  teardown(() => Helper.teardownStream(reqStream))
  const { request } = await Helper.pick(reqStream, { tag: 'final' })

  comment('signing request')
  const requestBytes = z32.decode(request)
  const resp1 = hs.sign(requestBytes, sec1, Helper.makePwd('info-flag-signer1-password'))
  const resp2 = hs.sign(requestBytes, sec2, Helper.makePwd('info-flag-signer2-password'))
  const responses = [z32.encode(resp1), z32.encode(resp2)]

  comment('getting multisig link')
  const linkStream = helper.multisig({
    action: 'link',
    publicKeys,
    quorum: 2,
    namespace: 'info-flag-test-ns'
  })
  teardown(() => Helper.teardownStream(linkStream))
  const { link: multisigLink } = await Helper.pick(linkStream, { tag: 'final' })

  comment('committing')
  const commitStream = helper.multisig({
    action: 'commit',
    publicKeys,
    quorum: 2,
    namespace: 'info-flag-test-ns',
    link: srcLink,
    request,
    responses,
    forceDangerous: true
  })
  teardown(() => Helper.teardownStream(commitStream))
  await Helper.pick(commitStream, { tag: 'final' })

  comment('pear info --multisig on multisig link')
  const infoStream = helper.info({ link: multisigLink, multisig: true, cmdArgs: [] })
  teardown(() => Helper.teardownStream(infoStream))
  const until = await Helper.pick(infoStream, [
    { tag: 'multisig' },
    { tag: 'info' },
    { tag: 'final' }
  ])
  const multisig = await until.multisig
  is(multisig.quorum, 2, 'quorum is 2')
  is(multisig.publicKeys.length, 2, 'two public keys')
  absent(await until.info, 'info tag not emitted when --multisig flag set')
})
