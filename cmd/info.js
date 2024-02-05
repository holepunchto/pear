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
 info         value             notes
-----------  ----------------- ------------------------------------------------
 live         ${live}           ${live ? '   released' : '  staged'}
 name         ${name}           project name
 channel      ${channel}${Array.from({ length: 19 - channel.length }).join(' ')}release channel
 release      ${release}${Array.from({ length: 19 - (release?.toString().length || 0) }).join(' ')}release version
`

const output = outputter('info', {
  retrieving: ({ z32 }) => `🔑 :-\n     pear:${z32}\n...`,
  keys,
  info,
  error: ({ code, stack }) => `Info Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function info (args) {
  try {
    const flags = parse.args(args, {
      boolean: ['json']
    })
    const { _, json } = flags
    const [key] = _
    const isKey = parse.run(key).key !== null
    if (isKey === false) throw new Error('Key "' + key + '" is not valid')
    const id = Bare.pid
    await output(json, ipc.info({ id, key }))
  } catch (err) {
    await ipc.usage.output('info', false)
    print(err.message, false)
    Bare.exit(1)
  }
}
