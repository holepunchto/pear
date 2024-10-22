const Hyperschema = require('hyperschema')
const SCHEMA_DIR = './output/hyperschema'

const schema = Hyperschema.from(SCHEMA_DIR)
const pear = schema.namespace('pear')

pear.register({
  name: 'dht-nodes',
  fields: [
    {
      name: 'host',
      type: 'string',
      required: true
    },
    {
      name: 'port',
      type: 'int',
      required: true
    }
  ]
})

pear.register({
  name: 'encryption-keys',
  fields: [
    {
      name: 'publicKey',
      type: 'string',
      required: true
    },
    {
      name: 'privateKey',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'permits',
  fields: [
    {
      name: 'z32',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'identity',
  fields: [
    {
      name: 'publicKey',
      type: 'string',
      required: true
    },
    {
      name: 'privateKey',
      type: 'string',
      required: false
    }
  ]
})

pear.register({
  name: 'apps',
  fields: [
    {
      name: 'key',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'apps-owned',
  fields: [
    {
      name: 'key',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'app-storage',
  fields: [
    {
      name: 'app',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'channels',
  fields: [
    {
      name: 'key',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'error-logs',
  fields: [
    {
      name: 'type',
      type: 'string',
      required: true
    },
    {
      name: 'trace',
      type: 'string',
      required: true
    }
  ]
})

pear.register({
  name: 'perf-stats',
  fields: [
    {
      name: 'uptimeSeconds',
      type: 'int',
      required: true
    },
    {
      name: 'ramUsage',
      type: 'float64',
      required: true
    },
    {
      name: 'cpuUsage',
      type: 'float64',
      required: true
    },
    {
      name: 'os',
      type: 'string',
      required: true
    }
  ]
})

Hyperschema.toDisk(schema)
