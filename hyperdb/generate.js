const path = require('bare-path')
const Hyperschema = require('hyperschema')
const Builder = require('hyperdb/builder')

const SCHEMA_DIR = path.join(__dirname, 'schema')
const DB_DIR = path.join(__dirname, 'db')

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
  name: 'bundle',
  fields: []
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

Hyperschema.toDisk(schema)

// hyperdb/db
const db = Builder.from(SCHEMA_DIR, DB_DIR)
const pearDB = db.namespace('pear')

pearDB.collections.register({
  name: 'bundle',
  schema: '@pear/bundle'
})

pearDB.collections.register({
  name: 'dht',
  schema: '@pear/dht'
})

Builder.toDisk(db)
