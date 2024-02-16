'use strict'

const { decode } = require('hypercore-id-encoding')
const ALIASES = { // require('./constants') <-- throws an error when required
  keet: getKeys('oeeoz3w6fjjt7bym3ndpa6hhicm8f8naxyk11z4iypeoupn6jzpo'),
  runtime: getKeys('nkw138nybdx6mtf98z497czxogzwje5yzu585c66ofba854gw3ro')
}
function getKeys (z32) {
  return {
    z32,
    buffer: require('hypercore-id-encoding').decode(z32),
    hex: require('hypercore-id-encoding').decode(z32).toString('hex')
  }
}

module.exports = parse

function parse (url) {
  const {
    protocol,
    pathname,
    hostname
  } = new URL(url)

  if (protocol === 'file:') {
    // file:///some/path/to/a/file.js
    const startsWithRoot = hostname === ''
    if (!pathname) throw new Error('Path is missing')
    if (!startsWithRoot) throw new Error('Path needs to start from the root, "/"')
    return {
      protocol,
      pathname
    }
  } else if (protocol === 'pear:') {
    // pear://keyOrAlias[/some/path]
    const [fork, length, keyOrAlias, hash] = hostname.split('.')
    const parts = hostname.split('.').length

    if (parts === 1) { // pear://keyOrAlias[/some/path]
      return {
        protocol,
        length: 0,
        fork: null,
        key: ALIASES[hostname]?.buffer || decode(hostname),
        pathname
      }
    }

    if (parts === 2) { // pear://fork.length[/some/path]
      throw new Error('Incorrect hostname')
    }

    if (parts === 3) { // pear://fork.length.keyOrAlias[/some/path]
      const isForkANumber = Number.isNaN(Number(fork))
      const isLengthANumber = Number.isNaN(Number(length))
      if (!isForkANumber || !isLengthANumber) throw new Error('Incorrect hostname')

      return {
        protocol,
        length: Number(length),
        fork: Number(fork),
        key: ALIASES[keyOrAlias]?.buffer || decode(keyOrAlias),
        pathname
      }
    }

    if (parts === 4) { // pear://fork.length.keyOrAlias.hash[/some/path]
      const isForkANumber = Number.isNaN(Number(fork))
      const isLengthANumber = Number.isNaN(Number(length))
      if (!isForkANumber || !isLengthANumber) throw new Error('Incorrect hostname')

      return {
        protocol,
        length: Number(length),
        fork: Number(fork),
        key: ALIASES[keyOrAlias]?.buffer || decode(keyOrAlias),
        hash: decode(hash),
        pathname
      }
    }

    throw new Error('Incorrect hostname')
  }

  throw new Error('Protocol is not supported')
}
