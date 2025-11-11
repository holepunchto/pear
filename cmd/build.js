'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const opwait = require('pear-opwait')
const hypercoreid = require('hypercore-id-encoding')
const { outputter, ansi } = require('pear-terminal')
const { arch, platform } = require('which-runtime')
const { ERR_INVALID_INPUT, ERR_INVALID_MANIFEST } = require('pear-errors')

const output = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Build target ${ansi.dim(dir)}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Compiling...\n',
  complete: ({ dir }) => `Build completed ${ansi.dim(dir)}\n`,
  error: ({ message }) => `Error: ${message}\n`
})

module.exports = (ipc) => {
  const kIPC = Symbol('ipc')
  class API {
    static IPC = kIPC
    get [kIPC]() {
      return ipc
    }
  }
  global.Pear = new API()

  return async function build(cmd) {
    const { json } = cmd.flags
    const isKey = plink.parse(cmd.args.channel).drive.key !== null
    const channel = isKey ? cmd.args.link : cmd.args.channel
    const link = isKey ? cmd.args.channel : null
    if (!channel && !link)
      throw ERR_INVALID_INPUT(
        'A valid pear link or the channel name must be specified.'
      )
    if (channel) {
      const { manifest } = await opwait(ipc.info({ link, channel, manifest: true }))
      // @TODO <channel>
    }

    const { manifest } = await opwait(ipc.info({ link, manifest: true }))
    const { drive } = plink.parse(link)

    if (!manifest.pear) {
      throw ERR_INVALID_MANIFEST(
        'Missing required "pear" field in package.json'
      )
    }
    const build = manifest.pear.build
    if (!build) {
      throw ERR_INVALID_MANIFEST(
        'Missing required "pear.build" field in package.json'
      )
    }

    const { dir = os.cwd() } = cmd.args
    const host = platform + '-' + arch
    const distributables = path.join(dir, build.distributables || 'distributables', host)
    await fs.promises.mkdir(distributables, { recursive: true })
    const z32 = hypercoreid.encode(drive.key)
    const defaults = {
      "id": z32,
      "name": `${build.name || manifest.pear.name || manifest.name}`,
      "version": `${build.version || manifest.pear.version || manifest.version}`,
      "author": `${build.author || manifest.pear.author || manifest.author}`,
      "description": `${build.description || manifest.pear.description || manifest.description}`,
      "darwin.identifier": `${build.darwin?.identifier || `pear.${z32}`}`,
      "darwin.category": `${build.darwin?.category || 'public.app-category.developer-tools'}`,
      "darwin.signingidentity": `${build.darwin?.['signing-identity'] || '-'}`,
      "darwin.entitlements": `${build.darwin?.entitlements || ''}`,
      "win.signingsubject": `${build.win32?.['signing-subject'] || ''}`,
      "win.signingthumbprint": `${build.win32?.['signing-thumbprint'] || ''}`,
      "linux.category": `${build.linux?.category || 'Development'}`
    }
    await opwait(await require('../init')('init/templates/distributables', distributables, {
      cwd: os.cwd(),
      ipc,
      force: true,
      defaults,
      autosubmit: true,
      ask: false,
      header: 'pear-build'
    }))
    await opwait(ipc.dump({ link: link + '/distributables/icons', dir: distributables, force: true }))
    await output(json, pearBuild({ dir: distributables }))
  }
}
