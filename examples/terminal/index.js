require('bare-process/global')
const out = require('prom-client', { with: { imports: './imports.json' } })
console.log('🚀 ~ out:', out)
