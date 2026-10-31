'use strict'
const context = require('../context')
const { outputter, ansi, isTTY, byteSize, print, status } = require('../lib/terminal.js')
const os = require('bare-os')
const path = require('bare-path')
const { cmdArgs } = require('../argv')
const { parse } = require('../lib/link')
const gray = isTTY ? ansi.gray : (value) => value
const clear = isTTY ? '\x1b[2K\r' : ''

const keys = (data, info) => {
  info.keys = data
}

const info = (
  {
    name,
    version,
    productName,
    upgrade,
    writable,
    length,
    byteLength,
    blobs,
    fork,
    verlink,
    targets
  },
  { keys }
) => {
  const blobsInfo = blobs
    ? `  Blobs Key:     ${gray(blobs.key)}
  Blobs Fork:    ${blobs.fork}
  Blobs Length:  ${blobs.length}
  Blobs Size:    ${byteSize(blobs.byteLength)}\n\n`
    : ''

  const targetsInfo = targets.length
    ? '  Targets:\n' +
      targets.map(({ platform, size }) => `    ${platform} (${byteSize(size)})`).join('\n') +
      '\n\n'
    : ''

  const productNameInfo = productName === undefined ? '' : `  Product Name:  ${productName}\n`

  const upgradeInfo =
    upgrade === undefined
      ? ''
      : `\n\n  Upgrade:       ${gray(typeof upgrade === 'string' ? upgrade : JSON.stringify(upgrade, 0, 2)?.replace(/\n/g, '\n  '))}`

  return `${clear}  Verlink:       ${verlink}
  App:           ${name}${version ? `@${version}` : ''}
${productNameInfo}  Writable:      ${writable}

${targetsInfo}  Drive Key:     ${gray(keys.project)}
  Drive Fork:    ${fork}
  Drive Length:  ${length}
  Drive Size:    ${byteSize(byteLength)}

${blobsInfo}  Discovery Key: ${gray(keys.discovery)}${upgradeInfo}`
}

const changelog = ({ changelog, full }) => `
 changelog [ ${full ? 'full' : 'latest'} ]
───────────────────────────────────────────────────────────────────────────────
 ${changelog}
`

const output = outputter('info', {
  retrieving: ({ link, onlyShowKey }, info) => {
    info.onlyShowKey = onlyShowKey
    if (onlyShowKey) return link
    const line = `\n  Info:          ${isTTY ? ansi.green(link) : link}`
    if (!isTTY) return line
    print(line)
    status(`  ${gray('loading...')}`)
  },
  empty: (data, info) => {
    info.empty = true
    return `${clear}[ Empty ]`
  },
  keys,
  info,
  changelog,
  error: (err) => {
    return `Info Error (code: ${err.code || 'none'}) ${err.stack}`
  },
  manifest: (data) => {
    return JSON.stringify(data.manifest, 0, 2)
  },
  multisig: ({ quorum, publicKeys, only }) => {
    let out =
      (only ? '' : '\n') +
      '  Multisig Quorum: ' +
      quorum +
      ' / ' +
      publicKeys.length +
      '\n  Public Signing Keys:'
    for (const key of publicKeys) out += '\n    ' + gray(key)
    return out + '\n'
  },
  final(data, info) {
    if (info.empty) return { success: 2 }
    return info.onlyShowKey && data.success ? {} : false
  }
})

module.exports = async function info(cmd) {
  const ipc = context.getIPC()
  const {
    json,
    changelog,
    fullChangelog: full,
    metadata,
    key: showKey,
    manifest,
    multisig
  } = cmd.flags
  const link = cmd.args.link || null
  if (link) parse(link)
  let dir = cmd.args.dir
  if (dir && path.isAbsolute(dir) === false) dir = path.resolve(os.cwd(), dir)
  if (!dir) dir = os.cwd()

  await output(
    json,
    ipc.info({
      link,
      showKey,
      metadata,
      changelog: full || changelog ? { full, max: 1 } : null,
      manifest,
      multisig,
      cmdArgs,
      dir
    })
  )
}
