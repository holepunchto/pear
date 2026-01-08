'use strict'
const plink = require('pear-link')
const { outputter } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { permit, isTTY } = require('pear-terminal')
const os = require('bare-os')
const path = require('bare-path')

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
 ${
   blobs
     ? `blobs.length      ${blobs?.length}
 blobs.fork        ${blobs?.fork}
 blobs.byteLength  ${blobs?.byteLength}`
     : ''
 }
`

const changelog = ({ changelog, full }) => `
 changelog [ ${full ? 'full' : 'latest'} ]
-------------------------------------------------------------------------------
 ${changelog}
`

const output = outputter('info', {
  retrieving: ({ z32, onlyShowKey }, info) => {
    info.onlyShowKey = onlyShowKey
    return onlyShowKey ? `pear://${z32}` : `---:\n pear://${z32}\n...`
  },
  keys,
  info,
  changelog,
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'info')
    } else {
      return `Info Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  },
  manifest: (data) => {
    return JSON.stringify(data.manifest, 0, 2)
  },
  final(data, info) {
    return info.onlyShowKey && data.success ? {} : false
  }
})

module.exports = async function info(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const {
    json,
    changelog,
    fullChangelog: full,
    metadata,
    key: showKey,
    manifest
  } = cmd.flags
  const isKey = cmd.args.link && plink.parse(cmd.args.link).drive.key !== null
  const channel = isKey ? null : cmd.args.link
  const link = isKey ? cmd.args.link : null
  if (link && isKey === false)
    throw ERR_INVALID_INPUT('Link "' + link + '" is not a valid key')
  let dir = cmd.args.dir
  if (dir && path.isAbsolute(dir) === false) dir = path.resolve(os.cwd(), dir)
  if (!dir) dir = os.cwd()

  await output(
    json,
    ipc.info({
      link,
      channel,
      showKey,
      metadata,
      changelog: full || changelog ? { full, max: 1 } : null,
      manifest,
      cmdArgs: Bare.argv.slice(1),
      dir
    }),
    { ask: cmd.flags.ask },
    ipc
  )
}
