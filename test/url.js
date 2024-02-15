'use strict'

const test = require('brittle')
const url = require('../lib/url')

test('Pear url', t => {
  t.plan(2)
  const { protocol, key } = url('pear://a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.is(protocol, 'pear')
  t.is(key, 'a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
})

test('Too short key in pear url', async t => {
  t.plan(1)
  t.exception(() => {
    url('pear://some-short-key')
  }, /pear key needs to be 64 characters long/)
})

test('File url with path', t => {
  t.plan(2)
  const { protocol, path } = url('file:///path/to/file.js')
  t.is(protocol, 'file')
  t.is(path, '/path/to/file.js')
})

test('File url that does not start from root', t => {
  t.plan(1)
  t.exception(() => {
    url('file://file.js')
  }, /Path needs to start from the root, "\/"/)
})

test('File url without a path', t => {
  t.plan(1)
  t.exception(() => {
    url('file://')
  }, /Path is missing/)
})

test('Local url with a path', t => {
  t.plan(3)
  const { protocol, appToken, path } = url('local://a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2/path/to/a/file.js')
  t.is(protocol, 'local')
  t.is(appToken, 'a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.is(path, '/path/to/a/file.js')
})

test('Local url without a path', t => {
  t.plan(3)
  const { protocol, appToken, path } = url('local://a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.is(protocol, 'local')
  t.is(appToken, 'a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2c3d4e5a1b2')
  t.absent(path)
})

test('Too short appToken in local url ', t => {
  t.plan(1)
  t.exception(() => {
    url('local://some-short-key')
  }, /App token neeeds to be 64 characters long/)
})

test('Unsupported protocol', t => {
  t.plan(1)
  t.exception(() => {
    url('some-protocol://thats-not-supported')
  }, /Protocol, "some-protocol", is not supported/)
})

test('No :// in url', t => {
  t.plan(1)
  t.exception(() => {
    url('foobar')
  }, /Protocol, "foobar", is not supported/)
})
