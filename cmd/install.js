'use strict'
const { ERR_NOT_FOUND } = require('pear-errors')
const receipts = require('../lib/receipts.js')
const manifest = require('../lib/manifest.js')

// pear install is implemented by the pear-install package, which runs standalone rather
// than through the sidecar. This wraps it: if the app asks to be paid for, check for a
// receipt first, then hand the parsed command straight through — so flags and help text
// still come from that package.
module.exports = async function install(cmd) {
  const link = cmd.args.link

  // paparam declares <link> as required, so it bails before this runner and link is always
  // set here. The guard is belt-and-braces: pear-install defaults a missing link to the
  // platform's own key, so if <link> is ever made optional a self-update must not be gated.
  if (link && receipts.enabled()) {
    // Most apps are free and never declare a price, so most installs never see a gate.
    // A link we cannot read is a link we cannot charge for: manifest.read returns null and
    // the install proceeds, which is the right failure for a tip.
    const payment = manifest.paymentOf(await manifest.read(link))
    if (payment && receipts.has(receipts.keyFor(link)) === false) {
      throw ERR_NOT_FOUND(asking(link, payment))
    }
  }

  return require('pear-install/cmd').runner(cmd)
}

function asking(link, payment) {
  const amount = receipts.format({
    amount: payment.amount ?? receipts.TIP.amount,
    decimals: payment.decimals ?? receipts.TIP.decimals,
    token: payment.token ?? receipts.TIP.token
  })
  return (
    `This app asks for ${amount} before installing\n` +
    `\n` +
    `  Pay to ${payment.payee}${payment.network ? ` on ${payment.network}` : ''}\n` +
    `\n` +
    `  $ pear tip ${link}\n` +
    `\n` +
    `  Tip mode is a proof of concept: the receipt is an ordinary local file and\n` +
    `  nothing is verified, so this is a request rather than a licence check.\n` +
    `  PEAR_TIP=off skips it entirely.`
  )
}
