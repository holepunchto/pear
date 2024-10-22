const fsp = require('bare-fs/promises')

module.exports = async () => {
  const text = await fsp.readFile(require.asset('../text-file.txt'))
  return text.toString()
}
