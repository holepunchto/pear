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

const output = outputter('list', {
  bundles,
  all,
  error: (err) => `List Error (code: ${err.code || 'none'}) ${err.stack}`,
  final: () => false
})

module.exports = (ipc) => async function list (cmd) {
  const data = await ipc.list({ bundles: cmd.flags.bundles })
  if (cmd.flags.bundles) {
    return await output(false, data, { tag: 'bundles' }, ipc)
  }
  return await output(false, data, { tag: 'all' }, ipc)
}
