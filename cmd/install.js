'use strict'
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const { isMac, isWindows } = require('which-runtime')
const crypto = require('hypercore-crypto')
const plink = require('pear-link')
const opwait = require('pear-opwait')
const Opstream = require('pear-opstream')
const { GC } = require('pear-constants')
const { ERR_INVALID_MANIFEST } = require('pear-errors')
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
  final({ data = {} }) {
    if (data.success === false) {
      return {
        output: 'print',
        success: false,
        message: data.exists
          ? 'Refusing to overwrite existing ' +
            data.dir +
            '\n  ' +
            ansi.dim('Manually remove to reinstall')
          : 'Failed'
      }
    }
    return { output: 'print', success: true, message: 'Installed'.padEnd(10) }
  }
})

class Install extends Opstream {
  constructor(ipc, params) {
    super((...args) => this.#op(...args), params)
    this._ipc = ipc
  }

  async #op({ link }) {
    const ipc = this._ipc
    const parsed = plink.parse(link)
    if (parsed.pathname) throw new Error('Link must not have pathname')
    const host = require.addon.host
    this.push({ tag: 'installing', data: { link, host } })

    const result = await opwait(ipc.info({ link, manifest: true }), ({ tag, data }) => {
      if (tag !== 'final') this.push({ tag, data })
    })

    if (result === null) throw ERR_INVALID_MANIFEST('Unable to read application manifest')

    const { manifest } = result
    const { name, productName, version, upgrade } = manifest
    const appName = productName ?? name
    const ext = isMac ? '.app' : isWindows ? '.msix' : '.AppImage'
    const key = '/by-arch/' + host + '/app/' + appName + ext
    const tmp = path.join(GC, crypto.hash(Buffer.from(link + key)).toString('hex'))
    const home = os.homedir()

    const dir = isMac
      ? path.join('/', 'Applications', appName + ext)
      : isWindows
        ? null
        : fs.existsSync(path.join(home, 'Applications'))
          ? path.join(home, 'Applications', appName + ext)
          : path.join(home, '.local', 'bin', appName + ext)

    const build = plink.serialize({ ...parsed, pathname: key })
    this.push({ tag: 'app', data: { app: appName, name, version, upgrade, key, tmp, dir } })

    await opwait(ipc.dump({ link: build, dir: tmp, force: true }), ({ tag, data }) => {
      if (tag !== 'final') this.push({ tag, data })
    })

    const from = path.join(tmp, 'by-arch', host, 'app', appName + ext)

    if (isWindows) {
      const MSIXManager = require('msix-manager')
      const manager = new MSIXManager()
      await manager.addPackage(from)
      this.final = { data: { success: true } }
      return
    }

    if (fs.existsSync(dir)) {
      this.final = { data: { success: false, exists: true, dir } }
      return
    }

    await fs.promises.rename(from, dir)

    if (!isMac) {
      const desktopDir = path.join(home, '.local', 'share', 'applications')
      const desktop =
        [
          '[Desktop Entry]',
          'Type=Application',
          `Name=${appName}`,
          `Exec=${dir}`,
          'Terminal=false'
        ].join('\n') + '\n'
      await fs.promises
        .writeFile(path.join(desktopDir, appName + '.desktop'), desktop)
        .catch((err) => {
          if (err.code !== 'ENOENT') throw err // ignore if no desktop dir
        })
    }

    this.final = { data: { success: true } }
  }
}

module.exports = async function (cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json } = cmd.flags
  const link = cmd.args.link
  const stream = new Install(ipc, { link })
  await output(json, stream)
}
