'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const { outputter, ansi } = require('pear-terminal')

const output = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Building into ${dir}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Compiling project...\n',
  complete: ({ dir }) => `\n${ansi.tick} Built appling at ${dir}\n`,
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
    // TODO: handle channel case
    const { drive }  = plink.parse(link)
    const { dir = os.cwd() } = cmd.args
    const distributables = path.join(dir, 'distributables')
    await fs.promises.mkdir(distributables, { recursive: true })
    const stream = await ipc.dump(link, { dir: distributables, list: ['package.json', 'icons'] })
    await new Promise(resolve => stream.once('end', resolve))

    const pkg = await import(path.join(distributables, 'package.json'), { assert: { type: 'json' } })
    const build = pkg.default.pear.build

    const tmpl = 'init/templates/distributables'
    const defaults = { 
      "id": `${drive.key}`,
      "name": `${build.name || pkg.default.name}`,
      "link": `${link}`,
      "version": `${build.version || pkg.default.version}`,
      "author": `${build.author || pkg.default.author}`,
      "description": `${build.description || pkg.default.description}`,
      "darwin.identifier": `${build.darwin?.identifier || ''}`,
      "darwin.category": `${build.darwin?.category || ''}`,
      "darwin.signingidentity": `${build.darwin?.['signing-identity'] || ''}`,
      "darwin.entitlements": `${build.darwin?.['entitlements'] || ''}`,
      "win.signingsubject": `${build.win32?.['signing-subject'] || ''}`,
      "win.signingthumbprint": `${build.win32?.['signing-thumbprint'] || ''}`,
      "linux.category": `${build.linux?.category || ''}`
    }
    await require('../init')(tmpl, dir, {
          cwd: os.cwd(),
          ipc,
          force: true,
          defaults,
          tmpl
        })
    await output(json, pearBuild({ link, dir }))
  }
}
