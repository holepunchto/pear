'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const opwait = require('pear-opwait')
const hypercoreid = require('hypercore-id-encoding')
const { outputter, ansi } = require('pear-terminal')

const output = outputter('build', {
  init: ({ dir }) => `Build target ${ansi.dim(dir)}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Compiling...\n',
  complete: ({ dir }) => `\n${ansi.pear} Build completed ${ansi.dim(dir)}\n`,
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
    const link = cmd.args.link
    const { drive } = plink.parse(link)
    const { manifest } = await opwait(ipc.info({ link, manifest: true }))
    const { dir = os.cwd() } = cmd.args
    const build = manifest.pear.build
    const dotPear = path.join(dir, '.pear')
    await fs.promises.mkdir(dotPear, { recursive: true })
    const z32 = hypercoreid.encode(drive.key)
    const defaults = {
      "id": z32,
      "name": `${build?.name || manifest.pear.name || manifest.name}`,
      "version": `${build?.version || manifest.pear.version || manifest.version}`,
      "author": `${build?.author || manifest.pear.author || manifest.author}`,
      "description": `${build?.description || manifest.pear.description || manifest.description}`,
      "darwin.identifier": `${build?.darwin?.identifier || `pear.${z32}`}`,
      "darwin.category": `${build?.darwin?.category || 'public.app-category.developer-tools'}`,
      "darwin.signingidentity": `${build?.darwin?.['signing-identity'] || '-'}`,
      "darwin.entitlements": `${build?.darwin?.entitlements || ''}`,
      "win.signingsubject": `${build?.win32?.['signing-subject'] || ''}`,
      "win.signingthumbprint": `${build?.win32?.['signing-thumbprint'] || ''}`,
      "linux.category": `${build?.linux?.category || 'Development'}`
    }
    await opwait(await require('../init')('init/templates/dot-pear', dotPear, {
      cwd: os.cwd(),
      ipc,
      force: true,
      defaults,
      autosubmit: true,
      ask: false,
      header: 'pear-build'
    }))
    // use staged icons when available
    await opwait(ipc.dump({
      link,
      dir: dotPear,
      only: '.pear/brand/icons',
      force: true
    }))
    await output(json, pearBuild({ dir: dotPear, manifest: defaults }))
  }
}
