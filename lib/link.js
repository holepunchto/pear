const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
function parse(link, name = 'pear link') {
  let parsed
  try {
    if (
      (link.startsWith('"') && link.endsWith('"')) ||
      (link.startsWith("'") && link.endsWith("'"))
    ) {
      link.slice(1, -1)
    }
    parsed = plink.parse(link.replace(/^['"]+|['"]+$/g, '')) // remove start/end quotes and double quotes
  } catch (err) {
    throw ERR_INVALID_INPUT(`A valid ${name} must be specified.`, { err })
  }

  if (!parsed || !parsed.drive || !parsed.drive.key) {
    throw ERR_INVALID_INPUT(`A valid ${name} must be specified.`)
  }

  return parsed
}

module.exports = { parse }
