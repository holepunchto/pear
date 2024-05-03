'use strict'
const hypercoreid = require('hypercore-id-encoding')
const constants = require('../lib/constants')
const { ERR_INVALID_LINK } = require('../lib/errors')

const parseLink = (link) => {
  if (!link) throw ERR_INVALID_LINK('No link specified')
  if (link.startsWith('pear://') === false) link = 'pear://' + link
  let parsed = null
  try {
    parsed = new URL(decodeURI(link))
  } catch {
    return { key: null, data: null }
  }
  let slash = parsed.pathname.indexOf('/')
  let alias = null
  let k = parsed.host ? parsed.host : parsed.pathname.slice(0, slash > -1 ? slash : parsed.pathname.length)
  if (!parsed.host) {
    // new URL returns non-writables, recreate the object:
    parsed = { ...parsed, pathname: parsed.pathname.slice(k.length) }
    slash = parsed.pathname.indexOf('/')
  }

  if (k === 'runtime' || k === 'keet') {
    alias = k
    k = constants.ALIASES[alias].z32
  } else {
    for (const [name, { z32, hex }] of Object.entries(constants.ALIASES)) {
      if (k !== z32 && k !== hex) continue
      alias = name
    }
  }

  const data = parsed.pathname.slice(slash > -1 ? slash + 1 : 0) || null

  try {
    const buffer = hypercoreid.decode(k)
    const key = { hex: buffer.toString('hex'), z32: hypercoreid.encode(buffer), buffer, link }
    return { key, data, alias }
  } catch {
    try {
      const buffer = hypercoreid.decode(link)
      const key = { hex: buffer.toString('hex'), z32: hypercoreid.encode(buffer), buffer, link }
      return { key, data, alias }
    } catch {
      return { key: null, data, alias }
    }
  }
}

module.exports = parseLink
