// This file is autogenerated by the hyperdb compiler
/* eslint-disable camelcase */

const { IndexEncoder, c } = require('hyperdb/runtime')

const { version, resolveStruct } = require('./messages.js')

const helpers0 = require('../helpers.js')

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

// '@pear/bundle' collection key
const collection1_key = new IndexEncoder([
  IndexEncoder.STRING
], { prefix: 1 })

function collection1_indexify (record) {
  const a = record.link
  return a === undefined ? [] : [a]
}

// '@pear/bundle' reconstruction function
function collection1_reconstruct (version, keyBuf, valueBuf) {
  const key = collection1_key.decode(keyBuf)
  const value = c.decode(resolveStruct('@pear/bundle/value', version), valueBuf)
  // TODO: This should be fully code generated
  return {
    link: key[0],
    ...value
  }
}
// '@pear/bundle' key reconstruction function
function collection1_reconstruct_key (keyBuf) {
  const key = collection1_key.decode(keyBuf)
  return {
    link: key[0]
  }
}

// '@pear/bundle'
const collection1 = {
  name: '@pear/bundle',
  id: 1,
  encodeKey (record) {
    const key = [record.link]
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
    return c.encode(resolveStruct('@pear/bundle/value', version), record)
  },
  trigger: null,
  reconstruct: collection1_reconstruct,
  reconstructKey: collection1_reconstruct_key,
  indexes: []
}

// '@pear/bundle-by-tags' collection key
const index2_key = new IndexEncoder([
  IndexEncoder.STRING,
  IndexEncoder.STRING
], { prefix: 2 })

// '@pear/bundle-by-tags' has the following schema defined key map
const index2_map = helpers0.tags

function index2_indexify (record) {
  const a = record
  return a === undefined ? [] : [a]
}

// '@pear/bundle-by-tags'
const index2 = {
  name: '@pear/bundle-by-tags',
  id: 2,
  encodeKey (record) {
    return index2_key.encode(index2_indexify(record))
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return index2_key.encodeRange({
      gt: (gt || gt === '') ? index2_indexify(gt) : null,
      lt: (lt || lt === '') ? index2_indexify(lt) : null,
      gte: (gte || gte === '') ? index2_indexify(gte) : null,
      lte: (lte || lte === '') ? index2_indexify(lte) : null
    })
  },
  encodeValue: (doc) => index2.collection.encodeKey(doc),
  encodeIndexKeys (record, context) {
    const mapped = index2_map(record, context)
    const keys = new Array(mapped.length)
    for (let i = 0; i < mapped.length; i++) {
      const mappedRecord = mapped[i]
      keys[i] = index2_key.encode([mappedRecord, record.link])
    }
    return keys
  },
  reconstruct: (keyBuf, valueBuf) => valueBuf,
  offset: collection1.indexes.length,
  collection: collection1
}
collection1.indexes.push(index2)

module.exports = {
  version,
  collections: [
    collection0,
    collection1
  ],
  indexes: [
    index2
  ],
  resolveCollection,
  resolveIndex
}

function resolveCollection (name) {
  switch (name) {
    case '@pear/dht': return collection0
    case '@pear/bundle': return collection1
    default: return null
  }
}

function resolveIndex (name) {
  switch (name) {
    case '@pear/bundle-by-tags': return index2
    default: return null
  }
}