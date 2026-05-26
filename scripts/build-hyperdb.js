/* SCHEMA SAFETY RULES

1. Schema fields are append-only: once a new field is added, it cannot be removed (comment as deprecated instead)
2. Deleting/resetting files in `./spec` directory is forbidden
3. After making changes: `npm run hyperdb:build`. Once merged into the main branch, there is no undoing.
*/
const path = require('path')
const Hyperschema = require('hyperschema')
const Builder = require('hyperdb/builder')

const SCHEMA_DIR = path.join(path.dirname(__dirname), 'spec', 'schema')
const DB_DIR = path.join(path.dirname(__dirname), 'spec', 'db')

const schema = Hyperschema.from(SCHEMA_DIR, { versioned: false })
const pearSchema = schema.namespace('pear')

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
  name: 'multisig',
  fields: [
    {
      name: 'key',
      type: 'fixed32',
      required: true
    }
  ]
})

Hyperschema.toDisk(schema)

const db = Builder.from(SCHEMA_DIR, DB_DIR)
const pearDB = db.namespace('pear')

pearDB.collections.register({
  name: 'dht',
  schema: '@pear/dht'
})

pearDB.collections.register({
  name: 'multisig',
  schema: '@pear/multisig',
  key: ['key']
})

Builder.toDisk(db)
