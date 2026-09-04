'use strict'
const { spawn } = require('bare-subprocess')
const { ERR_OPERATION_FAILED } = require('pear-errors')

const BIN = 'wdk'
const TIMEOUT = 60_000

// The WDK CLI reports failures as JSON on stdout and still exits 0, so the exit code says
// nothing — always parse, and treat an `error` field as the failure.
function run(args) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      reject(missing(err))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(ERR_OPERATION_FAILED(`${BIN} timed out after ${TIMEOUT / 1000}s`))
    }, TIMEOUT)

    child.stdout.on('data', (data) => {
      stdout += data
    })
    child.stderr.on('data', (data) => {
      stderr += data
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(missing(err))
    })

    child.on('exit', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        resolve(JSON.parse(stdout))
      } catch {
        const detail = (stdout || stderr).trim().split('\n')[0] || 'no output'
        reject(ERR_OPERATION_FAILED(`Could not read ${BIN} output: ${detail}`))
      }
    })
  })
}

function missing(err) {
  if (err.code !== 'ENOENT') return ERR_OPERATION_FAILED(`Could not run ${BIN}: ${err.message}`)
  return ERR_OPERATION_FAILED(
    `${BIN} is not installed.\n` +
      '  npm i -g @tetherto/wdk-cli --@tetherto:registry=https://registry.npmjs.org'
  )
}

// Quote a transfer without sending it. Returns what the wallet would charge, so the amount
// and fee can be shown before anyone confirms — WDK's own quote-then-confirm contract.
async function quote({ payee, amount, token, network, wallet }) {
  const result = await run(transferArgs({ payee, amount, token, network, wallet }, true))
  if (result.error) throw failed(result)
  return result
}

// Broadcasts for real. Deliberately a separate function from quote() rather than a flag on
// it, so nothing reaches this by passing the wrong argument — spending money should take
// calling the function named send.
async function send({ payee, amount, token, network, wallet }) {
  const args = transferArgs({ payee, amount, token, network, wallet })
  const result = await run(args)
  if (result.error) throw failed(result)
  return result
}

function transferArgs({ payee, amount, token, network, wallet }, dryRun = false) {
  const args = ['send', '--json', '--base-units', '--network', network]
  if (dryRun) args.push('--dry-run')
  args.push('--token', token, '--to', payee, '--amount', amount)
  if (wallet) args.push('--wallet', wallet)
  return args
}

// Lightning goes through the spark module's own methods rather than `wdk send`, which only
// speaks addresses and tokens. Same shape as above: quote first, then pay.
const LIGHTNING_NETWORK = 'spark'

async function quoteInvoice({ invoice, wallet }) {
  const args = [
    'method',
    'call',
    '--json',
    '--network',
    LIGHTNING_NETWORK,
    '--name',
    'quotePayLightningInvoice',
    '--encoded-invoice',
    invoice
  ]
  if (wallet) args.push('--wallet', wallet)
  const result = await run(args)
  if (result.error) throw failed(result)
  return result
}

async function payInvoice({ invoice, maxFeeSats, wallet }) {
  const args = [
    'method',
    'call',
    '--json',
    '--network',
    LIGHTNING_NETWORK,
    '--name',
    'payLightningInvoice',
    '--invoice',
    invoice,
    '--max-fee-sats',
    String(maxFeeSats)
  ]
  if (wallet) args.push('--wallet', wallet)
  const result = await run(args)
  if (result.error) throw failed(result)
  return result
}

// The bail handler prints info.message, not the Error's own message, so the suggestion has
// to go in both or it gets dropped on the way out.
function failed(result) {
  const message = `${tidy(result.error)}${result.suggestion ? `\n  ${result.suggestion}` : ''}`
  return ERR_OPERATION_FAILED(message, {
    code: result.code ?? 'ERR_WDK',
    message,
    suggestion: result.suggestion
  })
}

// Provider errors arrive with the whole ethers payload appended — calldata, revert struct,
// abi version. The readable part is everything before that, e.g.
// 'execution reverted: "ERC20: transfer amount exceeds balance"'.
function tidy(error) {
  const message = String(error)
  const cut = message.indexOf(' (action=')
  const short = cut === -1 ? message : message.slice(0, cut)
  return short.length > 300 ? short.slice(0, 300) + '…' : short
}

// Which tokens are registered on a network. Symbols differ per chain — the same Tether
// contract is 'usdt' on ethereum and 'usdt0' on polygon — so the name has to be checked
// against the network rather than assumed.
async function tokens(network) {
  const result = await run(['token', 'list', '--json'])
  if (result.error) throw failed(result)
  return result.tokens?.[network] ?? {}
}

// Registered networks, used to check whether a gasless sibling of a chain exists.
async function networks() {
  const result = await run(['network', 'list', '--json'])
  if (result.error) throw failed(result)
  return result.networks ?? []
}

// Read-only balance lookup, used to catch an unfundable quote before the provider turns it
// into a revert.
async function balance({ network, token, wallet }) {
  const args = ['get', 'balance', '--json', '--network', network]
  if (token) args.push('--token', token)
  if (wallet) args.push('--wallet', wallet)
  const result = await run(args)
  if (result.error) throw failed(result)
  return result
}

// Which address would pay. The dry-run preview doesn't include the sender, so it takes a
// second call. Best-effort: a tip is still worth recording if this fails.
async function payer({ network, wallet }) {
  const args = ['get', 'address', '--json', '--network', network]
  if (wallet) args.push('--wallet', wallet)
  try {
    const result = await run(args)
    if (result.error) return null
    return result.address ?? null
  } catch {
    return null
  }
}

module.exports = {
  BIN,
  LIGHTNING_NETWORK,
  quote,
  send,
  quoteInvoice,
  payInvoice,
  payer,
  balance,
  networks,
  tokens,
  run
}
