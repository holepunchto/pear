'use strict'

const { URL } = require('url')
const { ALIASES } = { ALIASES: { keet: 1, runtime: 1 } } // require('./constants') <-- throws an error when required

module.exports = parse

function parse (url) {
  const {
    protocol,
    pathname,
    hostname: key
  } = new URL(url)

  if (protocol === 'pear:') {
    // pear://64CharLongKeyOrAlias
    const isAlias = !!ALIASES[key]
    const hasCorrectLength = key.length === 64
    if (!isAlias && !hasCorrectLength) throw new Error('pear key needs to be 64 characters long')

    return {
      protocol,
      key,
      pathname
    }
  } else if (protocol === 'file:') {
    // file:///some/path/to/a/file.js
    const startsWithRoot = key === ''
    if (!pathname) throw new Error('Path is missing')
    if (!startsWithRoot) throw new Error('Path needs to start from the root, "/"')
    return {
      protocol,
      pathname
    }
  } else if (protocol === 'local:') {
    // local://64CharLongAppToken[/path/to/file.js]
    const appToken = key
    const hasCorrectLength = appToken.length === 64
    if (!hasCorrectLength) throw new Error('App token neeeds to be 64 characters long')

    return {
      protocol,
      appToken,
      pathname
    }
  }

  throw new Error(`Protocol, "${protocol}", is not supported`)
}
