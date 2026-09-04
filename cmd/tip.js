'use strict'
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')
const { outputter, hint, ansi, isTTY, Interact } = require('../lib/terminal.js')
const receipts = require('../lib/receipts.js')

const output = outputter('tip', {
  tipped: ({ file }) => `Receipt written to ${file}`,
  receipts: ({ dir, records }) => render(dir, records),
  final: ({ success, count }) => {
    if (count === undefined) return success ? 'Tipped' : 'No tip sent'
    return `${count} receipt${count === 1 ? '' : 's'}`
  }
})

function render(dir, all) {
  if (all.length === 0) return `\nNo tip receipts in ${dir}\n`
  let out = '\n' + ansi.dim(dir) + '\n'
  for (const receipt of all) {
    const amount = receipts.format(receipt)
    const method = receipt.payment?.method ?? 'unknown'
    out += `${ansi.bold(receipt.link)}\n`
    out += ansi.dim(`  ${amount} · ${method} · ${receipt.tippedAt}`) + '\n'
  }
  return out
}

module.exports = async function tip(cmd) {
  const json = cmd.flags.json

  if (cmd.flags.list === true) {
    const all = receipts.list()
    await output(json, [
      { tag: 'receipts', data: { dir: receipts.dir(), records: all } },
      { tag: 'final', data: { success: true, count: all.length } }
    ])
    return
  }

  const link = cmd.args.link
  const key = receipts.keyFor(link)

  const existing = receipts.read(key)
  if (existing) {
    // Not a usage error — the command was typed correctly — so don't let the bail handler
    // append the whole help text. ERR_OPERATION_FAILED with an info code prints the message
    // on its own, the way "already running" does elsewhere.
    const message =
      `Already tipped ${existing.link}\n` +
      `  Receipt: ${receipts.pathFor(key)}\n` +
      `  Tipped:  ${existing.tippedAt}`
    throw ERR_OPERATION_FAILED(message, { code: 'ERR_EXISTS', message })
  }

  if (cmd.flags.force !== true) {
    if (isTTY === false) {
      throw ERR_INVALID_INPUT('Not a terminal. Pass --force to tip without confirming.')
    }
    if ((await ask(link)) === false) {
      await output(json, [{ tag: 'final', data: { success: false, link } }])
      return
    }
  }

  const receipt = receipts.create(link)
  const file = receipts.write(key, receipt)

  await output(json, [
    { tag: 'tipped', data: { ...receipt, file } },
    { tag: 'final', data: { success: true } }
  ])

  if (!json) hint('Now install it', ['pear install ' + link])
}

// Interact rather than confirm(): confirm() loops until the magic word is typed, which has
// no way to say no. A tip needs a decline path, so read the answer and treat anything that
// is not y — including a bare Enter — as no.
async function ask(link) {
  const dialog =
    '\n' +
    `  Tip ${ansi.bold(receipts.TIP.display)} for ${ansi.bold(link)}\n` +
    ansi.dim('  Writes a local receipt. Nothing is paid and nothing is verified.') +
    '\n\n'
  const interact = new Interact(dialog, [
    {
      name: 'confirm',
      default: '',
      prompt: `  Tip ${receipts.TIP.display}`,
      delim: '? [y/N]',
      validation: () => true
    }
  ])
  const { fields } = await interact.run()
  return (
    String(fields.confirm ?? '')
      .trim()
      .toLowerCase() === 'y'
  )
}
