'use strict'
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs/promises')
const { isMac, isLinux, isWindows } = require('which-runtime')
const { ERR_INVALID_MANIFEST } = require('pear-errors')
const plink = require('pear-link')
const crypto = require('hypercore-crypto')
const opwait = require('pear-opwait')
const { GC } = require('pear-constants')
const env = require('bare-env')
const Opstream = require('../lib/opstream')

module.exports = class Install extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, system } = {}) {
    const parsed = plink.parse(link)
    if (parsed.pathname) throw new Error('Link must not have pathname')
    const host = require.addon.host
    this.push({ tag: 'installing', data: { link, host } })

    const result = await opwait(
      this.sidecar.info({ link, manifest: true }, this.client, this.sidecar),
      ({ tag, data }) => {
        if (tag === 'final') this.push({ tag: 'info-final', data })
        else this.push({ tag, data })
      }
    )

    if (result === null) throw ERR_INVALID_MANIFEST('Unable to read application manifest')

    const { manifest } = result
    const { name, productName, version, upgrade } = manifest
    const appName = productName ?? name
    const ext = isMac ? '.app' : isWindows ? '.exe' : '.AppImage'
    const key = '/by-arch/' + host + '/app/' + appName + ext
    const tmp = path.join(GC, crypto.hash(Buffer.from(link + key)).toString('hex'))
    const home = os.homedir()

    const dir = isMac
      ? path.join(system ? '/' : home, 'Applications', appName + ext)
      : isWindows
        ? system
          ? env.ProgramFiles
          : path.join(home, 'AppData', 'Local', appName + ext)
        : system
          ? path.join('/usr', 'local', 'bin', appName + ext)
          : path.join(home, '.local', 'bin', appName + ext)

    const build = plink.serialize({
      ...parsed,
      pathname: key
    })
    this.push({ tag: 'app', data: { app: appName, name, version, upgrade, key, tmp, dir } })
    await opwait(
      this.sidecar.dump({ link: build, dir: tmp, force: true }, this.client, this.sidecar),
      ({ tag, data }) => {
        if (tag === 'final') this.push({ tag: 'dumped-final', data })
        else this.push({ tag, data })
      }
    )

    const from = path.join(tmp, 'by-arch', 'darwin-arm64', 'app', appName + ext)
    let exists = false

    try {
      await fs.rename(from, dir)
    } catch (err) {
      if (err?.code === 'ENOTEMPTY') {
        exists = true
      } else {
        throw err
      }
    }

    if (exists) {
      this.final = {
        data: {
          success: false,
          message: 'Refusing to overwrite existing ',
          hint: 'Manually remove to force'
        }
      }
      return
    }

    if (isLinux) {
      // TODO: ~/.local/share/applications/<app>.desktop
    }

    if (isWindows) {
      // TODO: if not installers, then add to start menu + reg key at:
      // HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\<AppName>
    }

    this.push({ tag: 'installed' })
  }
}
