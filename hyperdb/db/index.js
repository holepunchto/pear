// This file is autogenerated by the hyperdb compiler
/* eslint-disable camelcase */

const { IndexEncoder, c } = require('hyperdb/runtime')

const { version, resolveStruct } = require('./messages.js')

// '@pear/bundle' collection key
const collection0_key = new IndexEncoder([
  IndexEncoder.STRING
], { prefix: 0 })

function collection0_indexify (record) {
  const a = record.key
  return a === undefined ? [] : [a]
}

// '@pear/bundle' reconstruction function
function collection0_reconstruct (version, keyBuf, valueBuf) {
  const key = collection0_key.decode(keyBuf)
  const value = c.decode(resolveStruct('@pear/bundle/value', version), valueBuf)
  // TODO: This should be fully code generated
  return {
    key: key[0],
    ...value
  }
}
// '@pear/bundle' key reconstruction function
function collection0_reconstruct_key (keyBuf) {
  const key = collection0_key.decode(keyBuf)
  return {
    key: key[0]
  }
}

// '@pear/bundle'
const collection0 = {
  name: '@pear/bundle',
  id: 0,
  encodeKey (record) {
    const key = [record.key]
    return collection0_key.encode(key)
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return collection0_key.encodeRange({
      gt: gt ? collection0_indexify(gt) : null,
      lt: lt ? collection0_indexify(lt) : null,
      gte: gte ? collection0_indexify(gte) : null,
      lte: lte ? collection0_indexify(lte) : null
    })
  },
  encodeValue (version, record) {
    return c.encode(resolveStruct('@pear/bundle/value', version), record)
  },
  trigger: null,
  reconstruct: collection0_reconstruct,
  reconstructKey: collection0_reconstruct_key,
  indexes: []
}

// '@pear/dht' collection key
const collection1_key = new IndexEncoder([
], { prefix: 1 })

function collection1_indexify (record) {
  return []
}

// '@pear/dht' reconstruction function
function collection1_reconstruct (version, keyBuf, valueBuf) {
  const value = c.decode(resolveStruct('@pear/dht/value', version), valueBuf)
  return value
}
// '@pear/dht' key reconstruction function
function collection1_reconstruct_key (keyBuf) {
  return {}
}

// '@pear/dht'
const collection1 = {
  name: '@pear/dht',
  id: 1,
  encodeKey (record) {
    const key = []
    return collection1_key.encode(key)
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return collection1_key.encodeRange({
      gt: gt ? collection1_indexify(gt) : null,
      lt: lt ? collection1_indexify(lt) : null,
      gte: gte ? collection1_indexify(gte) : null,
      lte: lte ? collection1_indexify(lte) : null
    })
  },
  encodeValue (version, record) {
    return c.encode(resolveStruct('@pear/dht/value', version), record)
  },
  trigger: null,
  reconstruct: collection1_reconstruct,
  reconstructKey: collection1_reconstruct_key,
  indexes: []
}

module.exports = {
  version,
  collections: [
    collection0,
    collection1
  ],
  indexes: [
  ],
  resolveCollection,
  resolveIndex
}

function resolveCollection (name) {
  switch (name) {
    case '@pear/bundle': return collection0
    case '@pear/dht': return collection1
    default: return null
  }
}

function resolveIndex (name) {
  switch (name) {
    default: return null
  }
}
