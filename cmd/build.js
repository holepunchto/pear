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
  init: ({ dorPear }) => `Init ${ansi.dim(dorPear)}\n`,
  build: ({ target }) => `Building ${ansi.dim(target)}\n`,
  complete: () => `\n${ansi.pear} Completed\n`,
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
    const z32 = hypercoreid.encode(drive.key)
    const { manifest: pkg } = await opwait(ipc.info({ link, manifest: true }))
    const { dir = os.cwd() } = cmd.args
    const build = pkg.pear.build
    const dotPear = path.join(dir, '.pear')
    await fs.promises.mkdir(dotPear, { recursive: true })
    const defaults = {
      "id": z32,
      "name": `${build?.name || pkg.pear?.name || pkg.name}`,
      "version": `${build?.version || pkg.pear?.version || pkg.version}`,
      "author": `${build?.author || pkg.pear?.author || pkg.author}`,
      "description": `${build?.description || pkg.pear?.description || pkg.description}`,
      "identifier": `${build?.identifier || `pear.${z32}`}`
    }
    await opwait(await require('../init')('init/templates/dot-pear', dotPear, {
      cwd: os.cwd(),
      ipc,
      force: true,
      defaults,
      autosubmit: true,
      ask: false,
      header: 'dot-pear'
    }))
    // use staged icons when available
    await opwait(ipc.dump({
      link,
      dir: dotPear,
      only: '.pear/brand/icons',
      force: true
    }))
    await output(json, pearBuild({ dotPear }))
  }
}
