const path = require('bare-path')
const Hyperschema = require('hyperschema')
const Builder = require('hyperdb/builder')

const SCHEMA_DIR = path.join(__dirname, '..', 'spec', 'schema')
const DB_DIR = path.join(__dirname, '..', 'spec', 'db')

// hyperdb/schema
const schema = Hyperschema.from(SCHEMA_DIR)
const pearSchema = schema.namespace('pear')

// custom types
pearSchema.register({
  name: 'node',
  fields: [
    {
      name: 'host',
      type: 'string',
      required: true
    },
    {
      name: 'port',
      type: 'uint',
      required: true
    }
  ]
})

// structs
pearSchema.register({
  name: 'dht',
  fields: [
    {
      name: 'nodes',
      type: '@pear/node',
      array: true
    }
  ]
})

pearSchema.register({
  name: 'bundle',
  fields: [
    {
      name: 'link',
      type: 'string',
      required: true
    },
    {
      name: 'appStorage',
      type: 'string',
      required: true
    },
    {
      name: 'encryptionKey',
      type: 'fixed32'
    },
    {
      name: 'tags',
      type: 'string',
      array: true
    }
  ]
})

pearSchema.register({
  name: 'gc',
  fields: [
    {
      name: 'type',
      type: 'string',
      required: true
    },
    {
      name: 'value',
      type: 'string',
      required: true
    }
  ]
})

Hyperschema.toDisk(schema)

// hyperdb/db
const db = Builder.from(SCHEMA_DIR, DB_DIR)
const pearDB = db.namespace('pear')
pearDB.require(path.join(__dirname, '..', 'spec', 'helpers.js'))

pearDB.collections.register({
  name: 'dht',
  schema: '@pear/dht'
})

pearDB.collections.register({
  name: 'gc',
  schema: '@pear/gc'
})

pearDB.collections.register({
  name: 'bundle',
  schema: '@pear/bundle',
  key: ['link']
})

pearDB.indexes.register({
  name: 'bundle-by-tags',
  collection: '@pear/bundle',
  unique: false,
  key: {
    type: 'string',
    map: 'tags'
  }
})

Builder.toDisk(db)
