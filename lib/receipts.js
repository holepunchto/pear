'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const constants = require('../constants.js')
const { parse } = require('./link.js')

// Tip mode is a proof of concept. Every app is assumed to cost the same, the receipt is a
// plain local file, and nothing is signed or verified on chain — writing the file by hand
// bypasses the gate entirely. That is intentional: it is a tip, not a licence check.
const TIP = { amount: '990000', token: 'usdt', decimals: 6, display: '0.99 USD₮' }
const VERSION = 1

// PLATFORM_DIR is null until constants.init() runs, so resolve it per call rather than at
// require time. PEAR_TIP_DIR overrides it, which is what the tests point at a temp dir.
function dir() {
  return os.getEnv('PEAR_TIP_DIR') || path.join(constants.PLATFORM_DIR, 'receipts')
}

function enabled() {
  return os.getEnv('PEAR_TIP') !== 'off'
}

// Receipts are keyed by drive key, not version, so a tip covers every version of an app.
// Bare links, verlinks and pathed links all encode to the same key.
function keyFor(link) {
  return hypercoreid.encode(parse(link).drive.key)
}

function pathFor(key) {
  return path.join(dir(), key + '.json')
}

function has(key) {
  return fs.existsSync(pathFor(key))
}

function read(key) {
  const file = pathFor(key)
  let buf
  try {
    buf = fs.readFileSync(file)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
  try {
    return JSON.parse(buf)
  } catch (err) {
    throw ERR_INVALID_INPUT(`Could not parse receipt ${file}: ${err.message}`)
  }
}

function write(key, receipt) {
  const file = pathFor(key)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n')
  return file
}

function list() {
  let names
  try {
    names = fs.readdirSync(dir())
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => read(name.slice(0, -'.json'.length)))
    .filter(Boolean)
}

// Shaped so a real payment fills fields in rather than replacing them: at that point
// method becomes 'wdk' and chain, payer and txHash carry real values.
function create(link) {
  const key = keyFor(link)
  return {
    version: VERSION,
    link: plink.serialize(key),
    key,
    // Base units, because that is what a token transfer takes — no float rounding anywhere
    // in the path. decimals travels with it so the receipt reads on its own: 990000 means
    // nothing without knowing usdt has six of them.
    amount: TIP.amount,
    decimals: TIP.decimals,
    token: TIP.token,
    chain: null,
    payer: null,
    payment: { method: 'stub', txHash: null },
    tippedAt: new Date().toISOString()
  }
}

// Base units to something a human reads: 990000 -> '0.99 usdt'
function format(receipt) {
  const decimals = receipt.decimals ?? TIP.decimals
  const base = 10n ** BigInt(decimals)
  const amount = BigInt(receipt.amount)
  const fraction = (amount % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${amount / base}${fraction ? '.' + fraction : ''} ${receipt.token}`
}

module.exports = {
  TIP,
  VERSION,
  dir,
  enabled,
  keyFor,
  pathFor,
  has,
  read,
  write,
  list,
  format,
  create
}
