'use strict'
const parseLink = require('../run/parse-link')
const { outputter } = require('./iface')
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { ERR_INVALID_INPUT } = require('../lib/errors')

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

module.exports = (ipc) => async function info (cmd) {
  const { json, changelog, fullChangelog: full, metadata, key: showKey, keys } = cmd.flags
  const isKey = parseLink(cmd.args.link).key !== null
  const channel = isKey ? null : cmd.args.link
  const key = isKey ? cmd.args.link : null
  if (key && isKey === false) throw new ERR_INVALID_INPUT('Key "' + key + '" is not valid')
  let dir = cmd.args.dir || os.cwd()
  if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()

  await output(json, ipc.info({
    key,
    channel,
    dir,
    showKey,
    keys,
    metadata,
    changelog,
    full
  }))
}
