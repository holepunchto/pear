'use strict'
const { outputter, byteSize, ansi } = require('pear-terminal')

const output = outputter('install', {
  installing: ({ link }) => `Installing... ${ansi.dim(link)}`,
  app({ app, version, upgrade, tmp, dir, key }) {
    return `App: ${app}\nVersion: ${version}\nUpgrade: ${upgrade}\nKey: ${key}\nTmp: ${tmp}\nDir: ${dir}`
  },
  dumping: ({ link, dir }) => `Syncing: ${link} into ${dir}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: ({ dryRun }) => {
    return dryRun ? '\nDumping dry run complete\n' : '\nDumping complete\n'
  },
  stats({ upload, download, peers }) {
    const dl =
      download.bytes + download.speed === 0
        ? ''
        : `[${ansi.down} ${byteSize(download.bytes)} - ${byteSize(download.speed)}/s ] `
    const ul =
      upload.bytes + upload.speed === 0
        ? ''
        : `[${ansi.up} ${byteSize(upload.bytes)} - ${byteSize(upload.speed)}/s ] `
    return {
      output: 'status',
      message: `[ Peers: ${peers} ] ${dl}${ul}`
    }
  },
  installed() {},
  async final({ data = {} }) {
    if (data.success === false) {
      return {
        output: 'print',
        success: data.success,
        message: data.exists
          ? 'Refusing to overwrite existing\n  ' + ansi.dim('Manually remove to reinstall')
          : 'Failed'
      }
    }
    if (data.msixPath) {
      const MSIXManager = require('msix-manager')
      const manager = new MSIXManager()
      await manager.addPackage(data.msixPath)
    }
    return { output: 'print', success: true, message: 'Installed'.padEnd(10) }
  }
})

module.exports = async function (cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json } = cmd.flags
  const link = cmd.args.link
  await output(json, ipc.install({ link }))
}
