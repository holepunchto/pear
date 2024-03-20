'use strict'

const test = require('brittle')
const url = require('../lib/url')
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

test('pear://key', t => {
  t.plan(5)
  const { protocol, length, fork, key, pathname } = url('pear://a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.is(protocol, 'pear:')
  t.is(length, 0)
  t.is(fork, null)
  t.is(key.toString('hex'), 'a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.absent(pathname)
})

test('pear://key/pathname', t => {
  t.plan(5)
  const { protocol, length, fork, key, pathname } = url('pear://a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2/some/path.js')
  t.is(protocol, 'pear:')
  t.is(length, 0)
  t.is(fork, null)
  t.is(key.toString('hex'), 'a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.is(pathname, '/some/path.js')
})

test('pear://invalid-key', t => {
  t.plan(1)
  t.exception(() => {
    url('pear://some-invalid-key')
  }, /Error: Invalid Hypercore key/)
})

test('pear://alias', t => {
  t.plan(5)
  const { protocol, length, fork, key, pathname } = url('pear://keet')
  t.is(protocol, 'pear:')
  t.is(length, 0)
  t.is(fork, null)
  t.is(key.toString('hex'), ALIASES.keet.hex)
  t.absent(pathname)
})

test('pear://alias/path', t => {
  t.plan(5)
  const { protocol, length, fork, key, pathname } = url('pear://keet/some/path')
  t.is(protocol, 'pear:')
  t.is(length, 0)
  t.is(fork, null)
  t.is(key.toString('hex'), ALIASES.keet.hex)
  t.is(pathname, '/some/path')
})

test('file:///path', t => {
  t.plan(2)
  const { protocol, pathname } = url('file:///path/to/file.js')
  t.is(protocol, 'file:')
  t.is(pathname, '/path/to/file.js')
})

test('file://non-root-path', t => {
  t.plan(1)
  t.exception(() => {
    url('file://file.js')
  }, /Path needs to start from the root, "\/"/)
})

test('Unsupported protocol', t => {
  t.plan(1)
  t.exception(() => {
    url('someprotocol://thats-not-supported')
  }, /Protocol is not supported/)
})

test('No :// in url', t => {
  t.plan(1)
  try {
    // Since this throws a TypeError, brittle does not catch it, and we need to try-catch
    url('foobar')
  } catch (err) {
    t.ok(err.message.includes('Invalid URL'))
  }
})
