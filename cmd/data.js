'use strict'
const { outputter } = require('./iface')

const bundles = (items) => {
  let out = 'BUNDLES\n'
  for (const b of items) {
    out += `- link: ${b.link}\n`
    out += `    appStorage: ${b.appStorage}\n`
    out += `    encryptionKey: ${b.encryptionKey}\n`
    out += `    tags: ${b.tags}\n`
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
  const result = await ipc.data({ bundles: cmd.flags.bundles })
  if (cmd.flags.bundles) {
    return await output(false, result, { tag: 'bundles' }, ipc)
  }
  return await output(false, result, { tag: 'all' }, ipc)
}
