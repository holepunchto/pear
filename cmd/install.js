'use strict'
const { ERR_NOT_FOUND } = require('pear-errors')
const receipts = require('../lib/receipts.js')

// pear install is implemented by the pear-install package, which runs standalone rather
// than through the sidecar. This wraps it: check for a tip receipt, then hand the parsed
// command straight through, so flags and help text still come from that package.
module.exports = function install(cmd) {
  const link = cmd.args.link

  // paparam declares <link> as required, so it bails before this runner and link is always
  // set here. The guard is belt-and-braces: pear-install defaults a missing link to the
  // platform's own key, so if <link> is ever made optional a self-update must not be gated.
  if (link && receipts.enabled() && receipts.has(receipts.keyFor(link)) === false) {
    throw ERR_NOT_FOUND(
      `Tip required — ${receipts.TIP.display}\n` +
        `\n` +
        `  No tip receipt for ${link}\n` +
        `\n` +
        `  $ pear tip ${link}\n` +
        `\n` +
        `  Tip mode is a proof of concept. The receipt is a local file, not a licence —\n` +
        `  set PEAR_TIP=off to skip this check entirely.\n`
    )
  }

  return require('pear-install/cmd').runner(cmd)
}
