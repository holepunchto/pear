'use strict'
const os = require('bare-os')
const { readFile } = require('bare-fs/promises')
const { join } = require('bare-path')
const plink = require('pear-link')
const { outputter, ansi, permit, isTTY, byteSize } = require('pear-terminal')

const output = outputter('seed', {
  stats({ peers, discoveryKey, contentKey, link, firewalled, natType, upload, download, connections, connecting }) {
    const ul = `[ ${ansi.up} ${byteSize(upload.speed)}/s ] `
    const dl = `[ ${ansi.down} ${byteSize(download.speed)}/s ] `
    let message = `\x1B[2J\x1B[H\n
 ${ansi.pear} seeding: ${link}
------------------------------------
 peers             ${peers}
 discoveryKey      ${discoveryKey}
 contentKey        ${contentKey}
 firewalled        ${firewalled}
 NAT Type          ${natType}
 upload            ${ul}
 download          ${dl}
 `;
    return {
      output: 'status',
      message
    }
  },
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'seed')
    } else {
      return `Seed Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  }
})

module.exports = async function seed(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, verbose, ask } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const isKey = plink.parse(cmd.args.channel).drive.key !== null
  const channel = isKey ? null : cmd.args.channel
  const link = isKey ? cmd.args.channel : null
  let { name } = cmd.flags
  if (!name && !link) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json')))
    name = pkg.pear?.name || pkg.name
  }
  const id = Bare.pid

  await output(
    json,
    ipc.seed({
      id,
      name,
      channel,
      link,
      verbose,
      dir,
      cmdArgs: Bare.argv.slice(1)
    }),
    { ask },
    ipc
  )
}
