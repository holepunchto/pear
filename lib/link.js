const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
function parse(link, name = 'pear link') {
  let parsed
  try {
    parsed = plink.parse(link)
  } catch (err) {
    throw ERR_INVALID_INPUT(`A valid ${name} must be specified.`, { err })
  }

  if (!parsed || !parsed.drive || !parsed.drive.key) {
    throw ERR_INVALID_INPUT(`A valid ${name} must be specified.`)
  }

  return parsed
}

module.exports = { parse }
