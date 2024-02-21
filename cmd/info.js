'use strict'
const parse = require('../lib/parse')
const { outputter, print } = require('./iface')

const keys = ({ content, discovery, project }) => `
 keys         hex
-----------  ------------------------------------------------------------------
 project      ${project}
 discovery    ${discovery}
 content      ${content}
`

const info = ({ channel, release, name, live }) => `
 info         value
-----------  -----------------
 live         ${live}
 name         ${name}
 channel      ${channel}
 release      ${release}
`

const changelog = ({ changelog }) => `
 changelog
-------------------------------------------------------------------------------
 ${changelog}
`

const output = outputter('info', {
  retrieving: ({ z32 }) => `🔑 :-\n     pear:${z32}\n...`,
  keys,
  info,
  changelog,
  error: ({ code, stack }) => `Info Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function info (args) {
  try {
    const flags = parse.args(args, {
      boolean: ['json']
    })
    const { _, json } = flags
    const [key] = _
    const isKey = key ? parse.runkey(key).key !== null : false
    if (key && isKey === false) throw new Error('Key "' + key + '" is not valid')
    const id = Bare.pid
    await output(json, ipc.info({ id, key }))
  } catch (err) {
    await ipc.usage.output('info', false)
    print(err.message, false)
    Bare.exit(1)
  }
}
