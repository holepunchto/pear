const fs = require('bare-fs')
const updates = require('pear-updates')
const restart = require('pear-restart')

const output = Pear.app.args[0]
if (!output) throw new Error('Output file path required as first argument')

updates((update) => {
  if (update.updated) restart({ platform: true })
})

Pear.versions().then((versions) => {
  fs.appendFileSync(output, JSON.stringify(versions) + '\n')
})
