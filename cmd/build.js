'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const opwait = require('pear-opwait')
const hypercoreid = require('hypercore-id-encoding')
const { outputter, ansi } = require('pear-terminal')

const outputBuild = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Building into ${dir}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Compiling project...\n',
  complete: ({ dir }) => `\n${ansi.tick} Built appling at ${dir}\n`,
  error: ({ message }) => `Error: ${message}\n`
})

const outputInit = outputter('init', {
  writing: () => '',
  error: ({ code, stack }) => `Init Error (code: ${code || 'none'}) ${stack}`,
  wrote: ({ path }) => `* ${path}`,
  written: () => ''
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
      // @TODO support channel param
    }
    const { manifest } = await opwait(ipc.info({ link, manifest: true }))
    const { drive } = plink.parse(link)
    const build = manifest.pear.build
    const { dir = os.cwd() } = cmd.args
    const distributables = path.join(dir, 'distributables')
    await fs.promises.mkdir(distributables, { recursive: true })
    const defaults = { 
      "id": hypercoreid.encode(drive.key),
      "name": `${build.name || manifest.name}`,
      "link": `${link}`,
      "version": `${build.version || manifest.version}`,
      "author": `${build.author || manifest.author}`,
      "description": `${build.description || manifest.description}`,
      "darwin.identifier": `${build.darwin?.identifier || ''}`,
      "darwin.category": `${build.darwin?.category || ''}`,
      "darwin.signingidentity": `${build.darwin?.['signing-identity'] || ''}`,
      "darwin.entitlements": `${build.darwin?.entitlements || ''}`,
      "win.signingsubject": `${build.win32?.['signing-subject'] || ''}`,
      "win.signingthumbprint": `${build.win32?.['signing-thumbprint'] || ''}`,
      "linux.category": `${build.linux?.category || ''}`
    }
    const tmpl = 'init/templates/distributables'
    const initStream = await require('../init')(tmpl, distributables, {
      cwd: os.cwd(),
      ipc,
      force: true,
      defaults,
      tmpl,
      autosubmit: true,
      ask: false,
      header: 'pear-build'
    })
    await outputInit(json, initStream)
    // overwrites default template icons with staged icons if exists
    await opwait(ipc.dump({ link: link + '/icons', dir: distributables, force: true }))
    await outputBuild(json, await pearBuild({ link, dir }))
  }
}
