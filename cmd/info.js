'use strict'
const parse = require('../lib/parse')
const { outputter, print } = require('./iface')
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')

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

const changelog = ({ changelog, full }) => `
 changelog [ ${full ? 'full' : 'latest'} ]
-------------------------------------------------------------------------------
 ${changelog}
`

const output = outputter('info', {
  retrieving: ({ z32 }) => `🔑 :-\n     pear://${z32}\n...`,
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
    const [from] = _
    let [, dir = ''] = _
    const isKey = from ? parse.runkey(from).key !== null : false
    const channel = isKey ? null : from
    const key = isKey ? from : null
    if (key && isKey === false) throw new Error('Key "' + key + '" is not valid')
    const id = Bare.pid
    if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
    await output(json, ipc.info({ id, key, channel, dir }))
  } catch (err) {
    await ipc.usage.output('info', false)
    print(err.message, false)
    Bare.exit(1)
  }
}
