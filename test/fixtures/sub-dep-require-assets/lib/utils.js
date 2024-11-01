const fs = require('bare-fs')

module.exports = () => fs.readFileSync(require.asset('../text-file.txt'), 'utf8')
