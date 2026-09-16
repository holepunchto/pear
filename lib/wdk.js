'use strict'
const { spawn } = require('bare-subprocess')
const { ERR_OPERATION_FAILED } = require('pear-errors')

const BIN = 'wdk'
const TIMEOUT = 60_000

// The WDK CLI exits non-zero on failure and also writes a JSON body carrying `error`,
// `code` and `suggestion`. We parse that body rather than branch on the exit status,
// because it is strictly richer — the status says something failed, the body says what and
// what to do about it. The exit code is used only when the body cannot be parsed.
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

    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        resolve(JSON.parse(stdout))
      } catch {
        // No parseable body, so the exit code is all we have left to go on.
        const detail = (stdout || stderr).trim().split('\n')[0] || 'no output'
        const status = code ? ` (exit ${code})` : ''
        reject(ERR_OPERATION_FAILED(`Could not read ${BIN} output${status}: ${detail}`))
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
// speaks addresses and tokens. Per the wallet team this is the intended route today, not a
// gap we are working around. Same shape as above: quote first, then pay.
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
//
// Workaround. The wallet team has confirmed this and intends to ship clean provider
// errors; drop this once a build does, and let their message through untouched.
function tidy(error) {
  const message = String(error)
  const cut = message.indexOf(' (action=')
  const short = cut === -1 ? message : message.slice(0, cut)
  return short.length > 300 ? short.slice(0, 300) + '…' : short
}

// Which tokens are registered on a network. Chains carry different assets, not the same
// asset under different names: ethereum has USDT (0xdAC17F95…), polygon has USDT0
// (0xc2132D05…) and no usdt entry at all. So a token name is only meaningful alongside a
// network, and has to be checked against one rather than assumed to carry over.
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

// Which address would pay. `send --dry-run` does not report the sender, so it takes a
// second call to find out. Best-effort: a tip is still worth recording if this fails.
//
// Workaround. The wallet team has confirmed this and intends to add `from` to the preview.
// Callers pass the quote's own `from` when there is one, so this call — and eventually this
// function — falls away on its own once a build ships it.
async function payer({ network, wallet, from = null }) {
  if (from) return from
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
