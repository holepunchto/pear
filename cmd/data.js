'use strict'
const { outputter } = require('./iface')

const bundles = (items) => {
  let out = 'BUNDLES\n'
  for (const bundle of items) {
    out += `- link: ${bundle.link}\n`
    out += `    appStorage: ${bundle.appStorage}\n`
    out += `    encryptionKey: ${bundle.encryptionKey}\n`
    out += `    tags: ${bundle.tags}\n`
  }
  return out
}

const all = (items) => bundles(items)

const output = outputter('data', {
  bundles,
  all,
  error: (err) => `Data Error (code: ${err.code || 'none'}) ${err.stack}`,
  final: () => false
})

module.exports = (ipc) => async function data (cmd) {
  const result = await ipc.data()
  return await output(false, result, { tag: 'bundle' }, ipc)
}
