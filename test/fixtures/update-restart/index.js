const fs = require('bare-fs')

const output = Pear.app.args[0]
if (!output) throw new Error('Output file path required as first argument')

Pear.updates(() => {
  Pear.restart({ platform: false })
})

Pear.versions().then((versions) => {
  fs.appendFileSync(output, JSON.stringify(versions) + '\n')
})
