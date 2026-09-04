'use strict'
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')
const { outputter, hint, ansi, isTTY, Interact } = require('../lib/terminal.js')
const receipts = require('../lib/receipts.js')
const manifest = require('../lib/manifest.js')
const wdk = require('../lib/wdk.js')
const uma = require('../lib/uma.js')
const { confirms, SEND_WORD } = require('../lib/tip-confirm.js')

const output = outputter('tip', {
  quoted: ({ rows }) =>
    table(rows) + '\n' + ansi.dim('  Dry run — nothing sent, no receipt written.'),
  tipped: ({ file, payment }) =>
    `Sent${payment.feeFormatted ? ` — fee ${payment.feeFormatted}` : ''}\n` +
    `  ${ansi.bold(payment.txHash ?? '(no transaction id)')}\n` +
    `Receipt written to ${file}`,
  configured: ({ payee, network, token, wallet }) =>
    `  Payee    ${payee ?? '(unset)'}\n` +
    `  Network  ${network}\n` +
    `  Token    ${token}` +
    (wallet ? `\n  Wallet   ${wallet}` : ''),
  receipts: ({ dir, records }) => render(dir, records),
  final: ({ success, count, configured, dryRun }) => {
    if (configured) return 'Saved'
    if (count !== undefined) return `${count} receipt${count === 1 ? '' : 's'}`
    if (dryRun) return 'Not sent'
    return success ? 'Tipped' : 'No tip sent'
  }
})

function table(rows) {
  const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0)
  return (
    '\n' +
    rows.map(([label, value]) => `  ${ansi.dim(label.padEnd(width))}  ${value}`).join('\n') +
    '\n'
  )
}

function render(dir, all) {
  if (all.length === 0) return `\nNo tip receipts in ${dir}\n`
  let out = '\n' + ansi.dim(dir) + '\n'
  for (const receipt of all) {
    const where = receipt.chain ? ` · ${receipt.chain}` : ''
    out += `${ansi.bold(receipt.link)}\n`
    out += ansi.dim(`  ${receipts.format(receipt)}${where} · ${receipt.tippedAt}`) + '\n'
  }
  return out
}

module.exports = async function tip(cmd) {
  const json = cmd.flags.json

  if (cmd.flags.save === true) {
    const patch = {}
    for (const key of ['payee', 'network', 'token', 'wallet']) {
      if (cmd.flags[key]) patch[key] = cmd.flags[key]
    }
    if (Object.keys(patch).length === 0) {
      throw ERR_INVALID_INPUT('--save needs something to save, e.g. --payee <address>')
    }
    const saved = receipts.setConfig(patch)
    await output(json, [
      { tag: 'configured', data: saved },
      { tag: 'final', data: { success: true, configured: true } }
    ])
    return
  }

  if (cmd.flags.list === true) {
    const all = receipts.list()
    await output(json, [
      { tag: 'receipts', data: { dir: receipts.dir(), records: all } },
      { tag: 'final', data: { success: true, count: all.length } }
    ])
    return
  }

  const dryRun = cmd.flags.dryRun === true
  const link = cmd.args.link
  const key = receipts.keyFor(link)

  const existing = receipts.read(key)
  if (existing) {
    // Not a usage error — the command was typed correctly — so don't let the bail handler
    // append the whole help text.
    const message =
      `Already tipped ${existing.link}\n` +
      `  Receipt: ${receipts.pathFor(key)}\n` +
      `  Tipped:  ${existing.tippedAt}`
    throw ERR_OPERATION_FAILED(message, { code: 'ERR_EXISTS', message })
  }

  // What the app asks for, if it asks for anything. Flags win over it, so a developer can
  // point a tip at any address to try the flow out.
  const declared = manifest.paymentOf(await manifest.read(link))
  const config = receipts.config()
  const payee = cmd.flags.payee ?? declared?.payee ?? config.payee
  const network = cmd.flags.network ?? declared?.network ?? config.network
  const token = cmd.flags.token ?? declared?.token ?? config.token
  const wallet = cmd.flags.wallet ?? config.wallet

  if (!payee) {
    const message =
      `Nothing to pay — ${link} does not ask for payment and no payee was given.\n` +
      `\n` +
      `  pear tip --payee <address> ${link}\n` +
      `  pear tip --save --payee <address>     remember one for next time`
    throw ERR_OPERATION_FAILED(message, { code: 'ERR_NO_PAYEE', message })
  }

  // A name@domain payee is an LNURL/UMA address, settleable only over Lightning. Anything
  // else is a chain address and goes over the token rail.
  const lightning = uma.isUsername(payee)
  const rail = lightning ? wdk.LIGHTNING_NETWORK : network
  const amount = lightning ? String(receipts.TIP.sats) : (declared?.amount ?? receipts.TIP.amount)
  const decimals = lightning ? 0 : (declared?.decimals ?? receipts.TIP.decimals)
  const unit = lightning ? 'sat' : token

  const payer = await wdk.payer({ network: rail, wallet })
  let resolved = null
  let quote = null

  if (lightning) {
    resolved = await uma.invoiceFor(payee, receipts.TIP.sats)
    quote = await wdk.quoteInvoice({ invoice: resolved.invoice, wallet })
  } else {
    await assertToken({ token, network })
    await assertFundable({ amount, decimals, token, network, wallet, payer })
    if (dryRun === false) await assertGas({ network, wallet })
    quote = await wdk.quote({ payee, amount, token, network, wallet })
  }

  const rows = summary({ quote, payer, payee, rail, lightning, amount, decimals, unit })

  // A dry run stops here on purpose: it writes no receipt, so it cannot open the gate.
  // Only money actually moving does that.
  if (dryRun) {
    await output(json, [
      { tag: 'quoted', data: { rows, payee, rail, amount, decimals, token: unit } },
      { tag: 'final', data: { success: true, dryRun: true } }
    ])
    return
  }

  if (cmd.flags.force !== true) {
    if (isTTY === false) {
      throw ERR_INVALID_INPUT(
        'Not a terminal. Pass --force to send without confirming, or --dry-run to preview.'
      )
    }
    if (confirms(await ask(link, rows)) === false) {
      await output(json, [{ tag: 'final', data: { success: false, link } }])
      return
    }
  }

  // The only place money moves.
  const sent = lightning
    ? await wdk.payInvoice({ invoice: resolved.invoice, maxFeeSats: maxFee(quote), wallet })
    : await wdk.send({ payee, amount, token, network, wallet })

  const receipt = receipts.create(link, {
    chain: rail,
    payer: sent.from ?? payer,
    amount,
    decimals,
    token: unit,
    payment: {
      method: 'transfer',
      rail: lightning ? 'lightning' : 'token',
      txHash: sent.txHash ?? sent.id ?? null,
      payee,
      declared: declared !== null,
      invoice: resolved?.invoice ?? null,
      fee: sent.fee ?? quote?.estimatedFee ?? quote?.feeSats ?? null,
      feeFormatted: sent.feeFormatted ?? quote?.estimatedFeeFormatted ?? null,
      wallet: wallet ?? null
    }
  })
  const file = receipts.write(key, receipt)

  await output(json, [
    { tag: 'tipped', data: { ...receipt, file } },
    { tag: 'final', data: { success: true } }
  ])

  if (!json) hint('Now install it', ['pear install ' + link])
}

function summary({ quote, payer, payee, rail, lightning, amount, decimals, unit }) {
  const fee = lightning
    ? quote?.feeSats !== undefined
      ? `${quote.feeSats} sats`
      : null
    : quote?.estimatedFeeFormatted
  const rows = [
    ['Amount', receipts.format({ amount, decimals, token: unit })],
    ['Fee', fee ?? ansi.dim('unknown')],
    ['Via', lightning ? `lightning (${rail})` : (quote?.networkName ?? rail)],
    ['To', payee]
  ]
  if (payer) rows.push(['From', payer])
  return rows
}

// Lightning needs a fee ceiling up front. Take the quote's own estimate with headroom, so a
// routing fee that drifts a little does not fail the payment outright.
function maxFee(quote) {
  return Math.max(Math.ceil(Number(quote?.feeSats ?? 0) * 2), 10)
}

// The same Tether contract is registered as 'usdt' on ethereum and 'usdt0' on polygon, so a
// network switch quietly breaks the token name. Say which names that network does have.
async function assertToken({ token, network }) {
  let available
  try {
    available = await wdk.tokens(network)
  } catch {
    return // let the quote report the real problem
  }
  if (available[token]) return

  const names = Object.keys(available).filter((name) => available[name].isNative !== true)
  const message =
    `No token "${token}" on ${network}.\n` +
    (names.length
      ? `  ${network} has: ${names.join(', ')}\n\n  pear tip --token ${names[0]} <link>`
      : `  ${network} has no registered tokens. See \`wdk token list\`.`)
  throw ERR_OPERATION_FAILED(message, { code: 'ERR_UNKNOWN_TOKEN', message })
}

// WDK registers ERC-4337 smart accounts as a parallel network per chain, e.g.
// smart-account-polygon, where a paymaster can cover gas. Only suggest one that exists.
async function gaslessSibling(network) {
  if (network.startsWith('smart-account-')) return null
  const candidate = `smart-account-${network}`
  try {
    const all = await wdk.networks()
    return all.some((entry) => entry.name === candidate) ? candidate : null
  } catch {
    return null
  }
}

// A transfer needs native currency for gas — POL on polygon, ETH on an L1. Catch an empty
// gas tank before asking someone to confirm spending, not after.
async function assertGas({ network, wallet }) {
  let held
  try {
    held = await wdk.balance({ network, wallet })
  } catch {
    return
  }
  if (BigInt(held.balance ?? 0) > 0n) return

  const symbol = held.symbol ?? 'native currency'
  const gasless = await gaslessSibling(network)
  const message =
    `No ${symbol} on ${network} to pay gas with.\n` +
    `  Holding the token is not enough — moving an ERC-20 costs gas, and gas is\n` +
    `  paid in ${symbol}, which the token cannot cover.\n` +
    `\n` +
    (gasless
      ? `  Either send a little ${symbol} to the wallet, or use the gasless account:\n` +
        `    pear tip --network ${gasless} <link>\n` +
        `  That is an ERC-4337 smart account with a paymaster. Note it has its own\n` +
        `  address, so the token has to be sitting there — check with:\n` +
        `    wdk get address --network ${gasless}\n`
      : `  Send a little ${symbol} to the wallet and try again.\n`) +
    `\n` +
    `  --dry-run previews the tip without needing any gas.`
  throw ERR_OPERATION_FAILED(message, { code: 'ERR_NO_GAS', message })
}

// An ERC-20 fee estimate simulates the transfer, so it reverts when the balance cannot
// cover it. Catch that here, where we can say which balance is short.
async function assertFundable({ amount, decimals, token, network, wallet, payer }) {
  let held
  try {
    held = await wdk.balance({ network, token, wallet })
  } catch {
    return // balance lookup is a courtesy; let the quote itself report the real problem
  }

  if (BigInt(held.balance ?? 0) >= BigInt(amount)) return

  const wanted = receipts.format({ amount, decimals, token })
  const message =
    `Not enough ${held.symbol ?? token} on ${network}.\n` +
    `  Holds ${held.formatted ?? held.balance}, needs ${wanted}\n` +
    (payer ? `  Wallet ${payer}\n` : '')
  throw ERR_OPERATION_FAILED(message, { code: 'ERR_INSUFFICIENT_BALANCE', message })
}

// Interact rather than confirm(): confirm() loops until the magic word is typed, which has
// no way to say no. A tip needs a decline path.
async function ask(link, rows) {
  const dialog =
    '\n' +
    `  Tip for ${ansi.bold(link)}\n` +
    table(rows) +
    '\n' +
    `  ${ansi.bold('This sends real funds and cannot be undone.')}\n\n`

  const interact = new Interact(dialog, [
    {
      name: 'confirm',
      default: '',
      prompt: `  Type ${SEND_WORD} to send`,
      delim: '',
      validation: () => true
    }
  ])
  const { fields } = await interact.run()
  return fields.confirm
}
