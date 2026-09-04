'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const crypto = require('hypercore-crypto')
const hid = require('hypercore-id-encoding')
const receipts = require('../lib/receipts.js')

function randomKey() {
  return hid.encode(crypto.keyPair().publicKey)
}

// Point the receipt store at a throwaway directory and restore the environment after.
// PEAR_TIP_DIR exists for exactly this, so the tests never touch the real platform dir.
function sandbox(teardown) {
  const dir = path.join(os.tmpdir(), 'pear-tip-test-' + randomKey().slice(0, 12))
  const had = os.hasEnv('PEAR_TIP_DIR')
  const previous = os.getEnv('PEAR_TIP_DIR')
  os.setEnv('PEAR_TIP_DIR', dir)
  teardown(() => {
    if (had) os.setEnv('PEAR_TIP_DIR', previous)
    else os.unsetEnv('PEAR_TIP_DIR')
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return dir
}

test('receipt key is the drive key, however the link is written', ({ plan, is, teardown }) => {
  plan(3)
  sandbox(teardown)
  const key = randomKey()

  is(receipts.keyFor(`pear://${key}`), key, 'bare link')
  is(receipts.keyFor(`pear://0.10.${key}`), key, 'verlink resolves to the same receipt')
  is(receipts.keyFor(`pear://${key}/sub/path`), key, 'pathed link resolves to the same receipt')
})

test('keyFor rejects a link that is not a pear link', ({ plan, exception, teardown }) => {
  plan(2)
  sandbox(teardown)

  exception(() => receipts.keyFor('not-a-link'), /valid pear link/, 'garbage')
  exception(() => receipts.keyFor('pear://nope'), /valid pear link/, 'bad z32')
})

test('reading a receipt that was never written returns null', ({ plan, is, teardown }) => {
  plan(2)
  sandbox(teardown)
  const key = randomKey()

  is(receipts.has(key), false, 'has is false')
  is(receipts.read(key), null, 'read is null, not a throw')
})

test('a written receipt round-trips', ({ plan, is, ok, teardown }) => {
  plan(5)
  const dir = sandbox(teardown)
  const link = `pear://${randomKey()}`
  const key = receipts.keyFor(link)

  const file = receipts.write(key, receipts.create(link))

  is(file, path.join(dir, key + '.json'), 'written where pathFor says')
  ok(fs.existsSync(file), 'file exists, parent directory created')
  is(receipts.has(key), true, 'has is true')

  const read = receipts.read(key)
  is(read.link, link, 'link round-trips')
  is(read.key, key, 'key round-trips')
})

test('a corrupt receipt reports the file rather than throwing a parse error', ({
  plan,
  exception,
  teardown
}) => {
  plan(1)
  const dir = sandbox(teardown)
  const key = randomKey()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, key + '.json'), '{ not json')

  exception(() => receipts.read(key), /Could not parse receipt/, 'names the file')
})

test('listing tolerates a missing directory and finds what was written', ({
  plan,
  is,
  ok,
  teardown
}) => {
  plan(3)
  sandbox(teardown)

  is(receipts.list().length, 0, 'no directory yet, empty list, no throw')

  const links = [`pear://${randomKey()}`, `pear://${randomKey()}`]
  for (const link of links) receipts.write(receipts.keyFor(link), receipts.create(link))

  const all = receipts.list()
  is(all.length, 2, 'both listed')
  ok(
    links.every((link) => all.some((receipt) => receipt.link === link)),
    'both links present'
  )
})

test('PEAR_TIP=off disables the gate', ({ plan, is, teardown }) => {
  plan(3)
  const had = os.hasEnv('PEAR_TIP')
  const previous = os.getEnv('PEAR_TIP')
  teardown(() => {
    if (had) os.setEnv('PEAR_TIP', previous)
    else os.unsetEnv('PEAR_TIP')
  })

  os.unsetEnv('PEAR_TIP')
  is(receipts.enabled(), true, 'on by default')

  os.setEnv('PEAR_TIP', 'off')
  is(receipts.enabled(), false, 'off disables it')

  os.setEnv('PEAR_TIP', 'on')
  is(receipts.enabled(), true, 'any other value leaves it on')
})

test('a new receipt records a stub payment that a real one can fill in', ({
  plan,
  is,
  teardown
}) => {
  plan(7)
  sandbox(teardown)
  const key = randomKey()
  const receipt = receipts.create(`pear://0.10.${key}/some/path`)

  is(receipt.version, receipts.VERSION, 'carries a version')
  is(receipt.link, `pear://${key}`, 'link is canonicalised to the bare origin')
  is(receipt.amount, receipts.TIP.amount, 'amount in base units, as transfer() takes it')
  is(receipt.decimals, 6, 'decimals travel with it, so the receipt reads on its own')
  is(receipt.payment.method, 'stub', 'nothing was actually paid')
  is(receipt.payment.txHash, null, 'no transaction to point at yet')
  is(receipt.payer, null, 'nobody paid it')
})

test('base units format back to the advertised price', ({ plan, is }) => {
  plan(4)
  const usdt = (amount) => receipts.format({ amount, decimals: 6, token: 'usdt' })

  is(usdt('990000'), '0.99 usdt', 'the tip amount is 0.99, not 990000')
  is(usdt('1000000'), '1 usdt', 'a whole unit has no trailing zeros')
  is(usdt('1'), '0.000001 usdt', 'smallest unit')
  is(
    receipts.format({ amount: '990000', token: 'usdt' }),
    '0.99 usdt',
    'a receipt written before decimals were recorded still reads correctly'
  )
})
