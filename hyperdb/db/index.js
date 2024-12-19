// This file is autogenerated by the hyperdb compiler
/* eslint-disable camelcase */

const { IndexEncoder, c } = require('hyperdb/runtime')

const { version, resolveStruct } = require('./messages.js')

// '@pear/dht' collection key
const collection0_key = new IndexEncoder([
], { prefix: 0 })

function collection0_indexify (record) {
  return []
}

// '@pear/dht' reconstruction function
function collection0_reconstruct (version, keyBuf, valueBuf) {
  const value = c.decode(resolveStruct('@pear/dht/value', version), valueBuf)
  return value
}
// '@pear/dht' key reconstruction function
function collection0_reconstruct_key (keyBuf) {
  return {}
}

// '@pear/dht'
const collection0 = {
  name: '@pear/dht',
  id: 0,
  encodeKey (record) {
    const key = []
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
    return c.encode(resolveStruct('@pear/dht/value', version), record)
  },
  trigger: null,
  reconstruct: collection0_reconstruct,
  reconstructKey: collection0_reconstruct_key,
  indexes: []
}

module.exports = {
  version,
  collections: [
    collection0
  ],
  indexes: [
  ],
  resolveCollection,
  resolveIndex
}

function resolveCollection (name) {
  switch (name) {
    case '@pear/dht': return collection0
    default: return null
  }
}

function resolveIndex (name) {
  switch (name) {
    default: return null
  }
}