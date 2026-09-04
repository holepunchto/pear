'use strict'
const opwait = require('pear-opwait')
const context = require('../context')

// How long to wait for a link's package.json before giving up. An install that has to reach
// the swarm is already slow; this only guards the extra lookup.
const TIMEOUT = 15_000

// Payment lives under the `pear` field of the app's package.json, alongside the rest of the
// Pear config, because package.json is what install already reads off the drive:
//
//   "pear": { "payment": { "amount": "990000", "token": "usdt",
//                          "network": "polygon", "payee": "0x…" } }
//
// Staging covers it like any other file, so a multisig release signs the price too. Nothing
// here verifies that signature — see the POC README for what would have to change.
function paymentOf(manifest) {
  const payment = manifest?.pear?.payment
  if (!payment || typeof payment !== 'object') return null
  if (!payment.payee) return null
  return {
    payee: String(payment.payee),
    amount: payment.amount === undefined ? null : String(payment.amount),
    decimals: payment.decimals ?? null,
    token: payment.token ?? null,
    network: payment.network ?? null
  }
}

// Fetch a link's package.json through the sidecar, which already has a corestore and swarm
// up, rather than opening our own. Returns null rather than throwing: a link we cannot read
// is a link we cannot charge for, and tip mode fails open by design.
async function read(link) {
  const ipc = context.getIPC()
  if (!ipc) return null

  let timer = null
  try {
    const stream = ipc.info({
      link,
      showKey: false,
      metadata: false,
      changelog: null,
      manifest: true,
      multisig: false,
      cmdArgs: [],
      dir: null
    })

    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        stream.destroy()
        resolve(null)
      }, TIMEOUT)
    })

    const final = await Promise.race([opwait(stream), timeout])
    return final?.manifest ?? null
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

module.exports = { read, paymentOf, TIMEOUT }
