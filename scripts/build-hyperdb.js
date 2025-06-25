const path = require('bare-path')
const Hyperschema = require('hyperschema')
const Builder = require('hyperdb/builder')

const SCHEMA_DIR = path.join(__dirname, '..', 'spec', 'schema')
const DB_DIR = path.join(__dirname, '..', 'spec', 'db')

// hyperdb/schema
const schema = Hyperschema.from(SCHEMA_DIR, { versioned: false })
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

pearSchema.register({
  name: 'checkout',
  fields: [
    {
      name: 'fork',
      type: 'uint',
      required: true
    },
    {
      name: 'length',
      type: 'uint',
      required: true
    }
  ]
})

// both structs & custom types
pearSchema.register({
  name: 'asset',
  fields: [
    {
      name: 'link',
      type: 'string',
      required: true
    },
    {
      name: 'ns',
      type: 'string',
      required: true
    },
    {
      name: 'path',
      type: 'string',
      required: true
    },
    {
      name: 'name',
      type: 'string'
    },
    {
      name: 'only',
      type: 'string',
      array: true
    }
  ]
})

// structs
pearSchema.register({
  name: 'manifest',
  fields: [
    {
      name: 'version',
      type: 'uint',
      required: true
    }
  ]
})

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
      name: 'path',
      type: 'string',
      required: true
    }
  ]
})

pearSchema.register({
  name: 'current',
  fields: [
    {
      name: 'link',
      type: 'string',
      required: true
    },
    {
      name: 'checkout',
      type: '@pear/checkout'
    },
    {
      name: 'assets',
      type: '@pear/asset',
      array: true
    }
  ]
})

Hyperschema.toDisk(schema)

// hyperdb/db
const db = Builder.from(SCHEMA_DIR, DB_DIR)
const pearDB = db.namespace('pear')
pearDB.require(path.join(__dirname, '..', 'spec', 'helpers.js'))

pearDB.collections.register({
  name: 'manifest',
  schema: '@pear/manifest'
})

pearDB.collections.register({
  name: 'dht',
  schema: '@pear/dht'
})

pearDB.collections.register({
  name: 'gc',
  schema: '@pear/gc',
  key: ['path']
})

pearDB.collections.register({
  name: 'bundle',
  schema: '@pear/bundle',
  key: ['link']
})

pearDB.collections.register({
  name: 'asset',
  schema: '@pear/asset',
  key: ['link']
})

pearDB.collections.register({
  name: 'current',
  schema: '@pear/current',
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
