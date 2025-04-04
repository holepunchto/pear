// This file is autogenerated by the hyperdb compiler
/* eslint-disable camelcase */

const { IndexEncoder, c } = require('hyperdb/runtime')
const { version, getEncoding, setVersion } = require('./messages.js')

const helpers0 = require('../helpers.js')

// '@pear/manifest' collection key
const collection0_key = new IndexEncoder([
], { prefix: 0 })

function collection0_indexify (record) {
  return []
}

// '@pear/manifest' value encoding
const collection0_enc = getEncoding('@pear/manifest')

// '@pear/manifest' reconstruction function
function collection0_reconstruct (version, keyBuf, valueBuf) {
  setVersion(version)
  const record = c.decode(collection0_enc, valueBuf)
  return record
}
// '@pear/manifest' key reconstruction function
function collection0_reconstruct_key (keyBuf) {
  return {}
}

// '@pear/manifest'
const collection0 = {
  name: '@pear/manifest',
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
    setVersion(version)
    return c.encode(collection0_enc, record)
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

// '@pear/dht' value encoding
const collection1_enc = getEncoding('@pear/dht')

// '@pear/dht' reconstruction function
function collection1_reconstruct (version, keyBuf, valueBuf) {
  setVersion(version)
  const record = c.decode(collection1_enc, valueBuf)
  return record
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
    setVersion(version)
    return c.encode(collection1_enc, record)
  },
  trigger: null,
  reconstruct: collection1_reconstruct,
  reconstructKey: collection1_reconstruct_key,
  indexes: []
}

// '@pear/gc' collection key
const collection2_key = new IndexEncoder([
  IndexEncoder.STRING
], { prefix: 2 })

function collection2_indexify (record) {
  const a = record.path
  return a === undefined ? [] : [a]
}

// '@pear/gc' value encoding
const collection2_enc = getEncoding('@pear/gc/hyperdb#2')

// '@pear/gc' reconstruction function
function collection2_reconstruct (version, keyBuf, valueBuf) {
  const key = collection2_key.decode(keyBuf)
  setVersion(version)
  const record = c.decode(collection2_enc, valueBuf)
  record.path = key[0]
  return record
}
// '@pear/gc' key reconstruction function
function collection2_reconstruct_key (keyBuf) {
  const key = collection2_key.decode(keyBuf)
  return {
    path: key[0]
  }
}

// '@pear/gc'
const collection2 = {
  name: '@pear/gc',
  id: 2,
  encodeKey (record) {
    const key = [record.path]
    return collection2_key.encode(key)
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return collection2_key.encodeRange({
      gt: gt ? collection2_indexify(gt) : null,
      lt: lt ? collection2_indexify(lt) : null,
      gte: gte ? collection2_indexify(gte) : null,
      lte: lte ? collection2_indexify(lte) : null
    })
  },
  encodeValue (version, record) {
    setVersion(version)
    return c.encode(collection2_enc, record)
  },
  trigger: null,
  reconstruct: collection2_reconstruct,
  reconstructKey: collection2_reconstruct_key,
  indexes: []
}

// '@pear/bundle' collection key
const collection3_key = new IndexEncoder([
  IndexEncoder.STRING
], { prefix: 3 })

function collection3_indexify (record) {
  const a = record.link
  return a === undefined ? [] : [a]
}

// '@pear/bundle' value encoding
const collection3_enc = getEncoding('@pear/bundle/hyperdb#3')

// '@pear/bundle' reconstruction function
function collection3_reconstruct (version, keyBuf, valueBuf) {
  const key = collection3_key.decode(keyBuf)
  setVersion(version)
  const record = c.decode(collection3_enc, valueBuf)
  record.link = key[0]
  return record
}
// '@pear/bundle' key reconstruction function
function collection3_reconstruct_key (keyBuf) {
  const key = collection3_key.decode(keyBuf)
  return {
    link: key[0]
  }
}

// '@pear/bundle'
const collection3 = {
  name: '@pear/bundle',
  id: 3,
  encodeKey (record) {
    const key = [record.link]
    return collection3_key.encode(key)
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return collection3_key.encodeRange({
      gt: gt ? collection3_indexify(gt) : null,
      lt: lt ? collection3_indexify(lt) : null,
      gte: gte ? collection3_indexify(gte) : null,
      lte: lte ? collection3_indexify(lte) : null
    })
  },
  encodeValue (version, record) {
    setVersion(version)
    return c.encode(collection3_enc, record)
  },
  trigger: null,
  reconstruct: collection3_reconstruct,
  reconstructKey: collection3_reconstruct_key,
  indexes: []
}

// '@pear/bundle-by-tags' collection key
const index4_key = new IndexEncoder([
  IndexEncoder.STRING,
  IndexEncoder.STRING
], { prefix: 4 })

// '@pear/bundle-by-tags' has the following schema defined key map
const index4_map = helpers0.tags

function index4_indexify (record) {
  const a = record
  return a === undefined ? [] : [a]
}

// '@pear/bundle-by-tags'
const index4 = {
  name: '@pear/bundle-by-tags',
  id: 4,
  encodeKey (record) {
    return index4_key.encode(index4_indexify(record))
  },
  encodeKeyRange ({ gt, lt, gte, lte } = {}) {
    return index4_key.encodeRange({
      gt: (gt || gt === '') ? index4_indexify(gt) : null,
      lt: (lt || lt === '') ? index4_indexify(lt) : null,
      gte: (gte || gte === '') ? index4_indexify(gte) : null,
      lte: (lte || lte === '') ? index4_indexify(lte) : null
    })
  },
  encodeValue: (doc) => index4.collection.encodeKey(doc),
  encodeIndexKeys (record, context) {
    const mapped = index4_map(record, context)
    const keys = new Array(mapped.length)
    for (let i = 0; i < mapped.length; i++) {
      const mappedRecord = mapped[i]
      keys[i] = index4_key.encode([mappedRecord, record.link])
    }
    return keys
  },
  reconstruct: (keyBuf, valueBuf) => valueBuf,
  offset: collection3.indexes.length,
  collection: collection3
}
collection3.indexes.push(index4)

const collections = [
  collection0,
  collection1,
  collection2,
  collection3
]

const indexes = [
  index4
]

module.exports = { version, collections, indexes, resolveCollection, resolveIndex }

function resolveCollection (name) {
  switch (name) {
    case '@pear/manifest': return collection0
    case '@pear/dht': return collection1
    case '@pear/gc': return collection2
    case '@pear/bundle': return collection3
    default: return null
  }
}

function resolveIndex (name) {
  switch (name) {
    case '@pear/bundle-by-tags': return index4
    default: return null
  }
}
