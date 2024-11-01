const fs = require('bare-fs')

module.exports = () => {
  return fs.readFileSync(require.asset('../text-file.txt'), 'utf8')
}
