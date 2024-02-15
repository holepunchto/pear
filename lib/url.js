'use strict'

const { ALIASES } = { ALIASES: { keet: 1, runtime: 1 } } // require('./constants') <-- throws an error when required

module.exports = parse

function parse (url) {
  const [ protocol, rest] = url.split('://')

  if (protocol === 'pear') {
    // pear://64CharLongKeyOrAlias
    const re = /^([^\/]*)(\/.*)?/ // `/(64CharLongKeyOrAlias)(/path/to/something)?`
    const [, key, path] = rest.match(re)
    const isAlias = !!ALIASES[key]
    const hasCorrectLength = key.length === 64
    if (!isAlias && !hasCorrectLength) throw new Error('pear key needs to be 64 characters long')

    return {
      protocol: 'pear',
      key,
      path
    }
  } else if (protocol === 'file') {
    // file:///some/path/to/a/file.js
    const hasPath = rest.length > 0
    const startsWithRoot = rest[0] === '/'
    if (!hasPath) throw new Error('Path is missing')
    if (!startsWithRoot) throw new Error('Path needs to start from the root, "/"')
    return {
      protocol: 'file',
      path: rest
    }
  } else if (protocol === 'local') {
    // local://64CharLongAppToken[/path/to/file.js]
    const re = /^([^\/]*)(\/.*)?/ // `/(64CharLongAppToken)(/path/to/file.js)?`
    const [, appToken, path] = rest.match(re)
    const hasCorrectLength = appToken.length === 64
    if (!hasCorrectLength) throw new Error('App token neeeds to be 64 characters long')

    return {
      protocol: 'local',
      appToken,
      path
    }
  }

  throw new Error(`Protocol, "${protocol}", is not supported`)
}
