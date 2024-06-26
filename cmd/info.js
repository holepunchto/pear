'use strict'
const parseLink = require('../run/parse-link')
const { outputter } = require('./iface')
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { ERR_INVALID_INPUT } = require('../errors')

const keys = ({ content, discovery, project }) => `
 keys         hex
-----------  ------------------------------------------------------------------
 project      ${project}
 discovery    ${discovery}
 content      ${content}
`

const info = ({ channel, release, name, length, byteLength, blobs, fork }) => `
 info              value
-----------------  -----------------
 name              ${name}
 channel           ${channel}
 release           ${release}
 length            ${length}
 fork              ${fork}
 byteLength        ${byteLength}
 ${blobs
  ? `blobs.length      ${blobs?.length}
 blobs.fork        ${blobs?.fork}
 blobs.byteLength  ${blobs?.byteLength}`
  : ''}
`

const changelog = ({ changelog, full }) => `
 changelog [ ${full ? 'full' : 'latest'} ]
-------------------------------------------------------------------------------
 ${changelog}
`

const output = outputter('info', {
  retrieving: ({ z32 }) => `---:\n pear://${z32}\n...`,
  keys,
  info,
  changelog,
  error: ({ code, stack }) => `Info Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function info (cmd) {
  const { json, changelog, fullChangelog: full, metadata, key: showKey } = cmd.flags
  const isKey = cmd.args.link && parseLink(cmd.args.link).drive.key !== null
  const channel = isKey ? null : cmd.args.link
  const link = isKey ? cmd.args.link : null
  if (link && isKey === false) throw ERR_INVALID_INPUT('Link "' + link + '" is not a valid key')
  let dir = cmd.args.dir || os.cwd()
  if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()

  await output(json, ipc.info({
    link,
    channel,
    dir,
    showKey,
    metadata,
    changelog,
    full,
    cmdArgs: Bare.argv.slice(1)
  }))
}
