'use strict'
const https = require('bare-https')
const { ERR_OPERATION_FAILED } = require('pear-errors')

const TIMEOUT = 20_000
const MAX_BODY = 1 << 20 // a payRequest is a couple of KB; anything near this is wrong

// A tether.me username is an LNURL-pay / UMA address: user@domain, resolved by fetching
// https://<domain>/.well-known/lnurlp/<user>. WDK has no notion of these — it pays bolt11
// invoices and raw chain addresses — so the resolution is ours to do.
//
// Only Lightning settlement is reachable this way. The payRequest advertises on-chain
// settlement options too, but selecting one needs a signed UMA request from a registered
// VASP, which this is not.
function isUsername(payee) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payee ?? ''))
}

function get(url) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (err, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) {
        reject(err)
        return
      }
      resolve(value)
    }

    const timer = setTimeout(() => {
      req.destroy()
      done(ERR_OPERATION_FAILED(`Timed out resolving ${host(url)}`))
    }, TIMEOUT)

    const req = https.request(url, { method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
        if (body.length > MAX_BODY) {
          req.destroy()
          done(ERR_OPERATION_FAILED(`${host(url)} returned too much data`))
        }
      })
      res.on('end', () => {
        let json
        try {
          json = JSON.parse(body)
        } catch {
          done(ERR_OPERATION_FAILED(`${host(url)} did not return JSON (HTTP ${res.statusCode})`))
          return
        }
        // LNURL reports failures in the body with HTTP 200 as often as not, so check both.
        if (json.status === 'ERROR' || json.reason) {
          done(ERR_OPERATION_FAILED(`${host(url)}: ${json.reason ?? 'request rejected'}`))
          return
        }
        if (res.statusCode >= 400) {
          done(ERR_OPERATION_FAILED(`${host(url)} returned HTTP ${res.statusCode}`))
          return
        }
        done(null, json)
      })
    })

    req.on('error', (err) =>
      done(ERR_OPERATION_FAILED(`Could not reach ${host(url)}: ${err.message}`))
    )
    req.end()
  })
}

function host(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// Turn user@domain plus an amount in sats into a bolt11 invoice payable by any Lightning
// wallet. Two hops: the well-known payRequest, then its callback.
async function invoiceFor(payee, sats) {
  const [name, domain] = String(payee).split('@')
  const millisats = BigInt(sats) * 1000n

  const request = await get(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`)
  if (!request.callback) {
    throw ERR_OPERATION_FAILED(`${payee} did not return a payment callback`)
  }

  const min = BigInt(request.minSendable ?? 1)
  const max = BigInt(request.maxSendable ?? Number.MAX_SAFE_INTEGER)
  if (millisats < min || millisats > max) {
    throw ERR_OPERATION_FAILED(
      `${payee} accepts ${min / 1000n} to ${max / 1000n} sats, not ${sats}`
    )
  }

  const separator = request.callback.includes('?') ? '&' : '?'
  const response = await get(`${request.callback}${separator}amount=${millisats}`)
  if (!response.pr) throw ERR_OPERATION_FAILED(`${payee} did not return an invoice`)

  return { invoice: response.pr, payee, sats, domain }
}

module.exports = { isUsername, invoiceFor, get }
