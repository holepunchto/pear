const Hyperschema = require('hyperschema')
const Builder = require('hyperdb/builder')

const SCHEMA_DIR = './spec/schema'
const DB_DIR = './spec/db'

const schema = Hyperschema.from(SCHEMA_DIR)
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
  name: 'encryption-keys',
  fields: [
    { name: 'publicKey', type: 'string', required: true },
    { name: 'privateKey', type: 'string', required: true }
  ]
})

pearSchema.register({
  name: 'permits',
  fields: [{ name: 'z32', type: 'string', required: true }]
})

pearSchema.register({
  name: 'identity',
  fields: [
    { name: 'publicKey', type: 'string', required: true },
    { name: 'privateKey', type: 'string', required: false }
  ]
})

pearSchema.register({
  name: 'apps',
  fields: [{ name: 'key', type: 'string', required: true }]
})

pearSchema.register({
  name: 'apps-owned',
  fields: [{ name: 'key', type: 'string', required: true }]
})

pearSchema.register({
  name: 'app-storage',
  fields: [{ name: 'app', type: 'string', required: true }]
})

pearSchema.register({
  name: 'channels',
  fields: [{ name: 'key', type: 'string', required: true }]
})

pearSchema.register({
  name: 'error-logs',
  fields: [
    { name: 'type', type: 'string', required: true },
    { name: 'trace', type: 'string', required: true }
  ]
})

pearSchema.register({
  name: 'perf-stats',
  fields: [
    { name: 'uptimeSeconds', type: 'int', required: true },
    { name: 'ramUsage', type: 'float64', required: true },
    { name: 'cpuUsage', type: 'float64', required: true },
    { name: 'os', type: 'string', required: true }
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
  name: 'encryption-keys',
  schema: '@pear/encryption-keys',
  key: ['publicKey']
})

pearDB.collections.register({
  name: 'permits',
  schema: '@pear/permits',
  key: ['z32']
})

pearDB.collections.register({
  name: 'identity',
  schema: '@pear/identity',
  key: ['publicKey']
})

pearDB.collections.register({
  name: 'apps',
  schema: '@pear/apps',
  key: ['key']
})

pearDB.collections.register({
  name: 'apps-owned',
  schema: '@pear/apps-owned',
  key: ['key']
})

pearDB.collections.register({
  name: 'app-storage',
  schema: '@pear/app-storage',
  key: ['app']
})

pearDB.collections.register({
  name: 'channels',
  schema: '@pear/channels',
  key: ['key']
})

pearDB.collections.register({
  name: 'error-logs',
  schema: '@pear/error-logs',
  key: ['type']
})

pearDB.collections.register({
  name: 'perf-stats',
  schema: '@pear/perf-stats'
})

Builder.toDisk(db)
