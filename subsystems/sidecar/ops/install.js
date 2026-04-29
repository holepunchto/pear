'use strict'
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs/promises')
const { isMac, isWindows } = require('which-runtime')
const { ERR_INVALID_MANIFEST } = require('pear-errors')
const plink = require('pear-link')
const crypto = require('hypercore-crypto')
const opwait = require('pear-opwait')
const { GC } = require('pear-constants')
const Opstream = require('../lib/opstream')

module.exports = class Install extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link } = {}) {
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
    const ext = isMac ? '.app' : isWindows ? '.msix' : '.AppImage'
    const key = '/by-arch/' + host + '/app/' + appName + ext
    const tmp = path.join(GC, crypto.hash(Buffer.from(link + key)).toString('hex'))
    const home = os.homedir()

    const dir = isMac
      ? path.join('/', 'Applications', appName + ext)
      : isWindows
        ? null // Windows: MSIX installer handles placement
        : await linuxInstallPath()

    function linuxInstallPath () {
      return fs.stat(path.join(home, 'Applications')).then(() => path.join(home, 'Applications', appName + ext), () => path.join(home, '.local', 'bin', appName + ext))
    }

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

    const from = path.join(tmp, 'by-arch', host, 'app', appName + ext)

    this.final = { data: { success: true, from, dir, appName } }
  }
}
