'use strict'
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const { spawnSync } = require('bare-subprocess')
const LocalDrive = require('localdrive')
const { isMac, isLinux, isWindows } = require('which-runtime')
const crypto = require('hypercore-crypto')
const plink = require('pear-link')
const opwait = require('pear-opwait')
const Opstream = require('pear-opstream')
const { GC } = require('pear-constants')
const { ERR_INVALID_MANIFEST } = require('pear-errors')
const { outputter, byteSize, ansi } = require('pear-terminal')

const output = outputter('install', {
  installing: ({ link }) => `Installing... ${ansi.dim(link)}`,
  app({ app, version, upgrade, dest, key }) {
    return `App: ${app}\nVersion: ${version}\nLink: ${upgrade}\nPathname: ${key}\nTarget: ${dest}`
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
  warn: ({ message }) => `Warning: ${ansi.dim(message)}`,
  final({ data = {} }) {
    if (data.success === false) {
      let message
      if (data.permission) {
        const dir = path.dirname(data.dest)
        const fix = isMac
          ? `sudo chgrp admin ${dir} && sudo chmod g+w ${dir}`
          : `sudo chown -R "$(id -un):$(id -gn)" ${dir}`
        message = `Permission denied: ${data.dest}\n  ${ansi.dim('Fix: ' + fix)}`
      } else if (data.exists && data.exists.length) {
        message = isWindows
          ? `Already installed:\n${data.exists.map(({ filename }) => '  ' + filename).join('\n')}\n  ${ansi.dim('Manually uninstall to reinstall')}`
          : `Refusing to overwrite existing:\n${data.exists.map(({ dest }) => '  ' + dest).join('\n')}\n  ${ansi.dim('Manually remove to reinstall')}`
      } else if (data.notFound) {
        message = `Not found: ${data.notFound}`
      } else {
        message = 'Failed'
      }
      return { output: 'print', success: false, message }
    }
    return { output: 'print', success: true, message: 'Installed'.padEnd(10) }
  }
})

class Install extends Opstream {
  constructor(ipc, params) {
    super((...args) => this.#op(...args), params)
    this._ipc = ipc
    this.targets = []
  }

  async #op({ link, only, to }) {
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
    const { name, productName, version, upgrade, bin } = manifest
    const appName = productName ?? name
    const home = os.homedir()

    if (bin) {
      const bins = typeof bin === 'string' ? { [name]: bin } : bin
      for (const binName of Object.keys(bins)) {
        const ext = isWindows ? '.msix' : ''
        const dest = isWindows
          ? null
          : to
            ? path.join(to, binName + ext)
            : isMac
              ? path.join('/', 'usr', 'local', 'bin', binName)
              : path.join(home, '.local', 'bin', binName)
        this.targets.push({ filename: binName, ext, dest, isBin: true })
      }
    }

    const ext = isMac ? '.app' : isWindows ? '.msix' : '.AppImage'
    const dest = isWindows
      ? null
      : to
        ? path.join(to, appName + ext)
        : isMac
          ? path.join('/', 'Applications', appName + ext)
          : fs.existsSync(path.join(home, 'Applications'))
            ? path.join(home, 'Applications', appName + ext)
            : fs.existsSync(path.join(home, 'AppImages'))
              ? path.join(home, 'AppImages', appName + ext)
              : path.join(home, '.local', 'bin', appName + ext)

    this.targets.push({ filename: appName, ext, dest, isBin: false })

    const present = new Set()
    const appPath = '/by-arch/' + host + '/app/'
    await opwait(
      ipc.dump({
        link: plink.serialize({ ...parsed, pathname: appPath }),
        dir: '-',
        list: true,
        only
      }),
      ({ tag, data }) => {
        if (tag === 'file') present.add(data.key.slice(1))
      }
    )

    const required = only
      ? only
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : this.targets.filter((t) => t.isBin || !bin).map((t) => t.filename + t.ext)
    const missing = required.filter((r) => !present.has(r))
    if (missing.length) {
      this.final = { data: { success: false, notFound: missing.join(', ') } }
      return
    }

    this.targets = this.targets.filter(({ filename, ext }) => present.has(filename + ext))

    const exists = []
    let installed = 0

    for (const { filename, ext, dest, isBin } of this.targets) {
      if (isWindows) {
        const ps = spawnSync('powershell', [
          '-NoProfile',
          '-Command',
          `(Get-AppxPackage '${filename}') -ne $null`
        ])
        if (ps.stdout.toString().trim() === 'True') {
          exists.push({ filename, dest })
          continue
        }
      } else if (fs.existsSync(dest)) {
        exists.push({ filename, dest })
        continue
      }

      const key = appPath + filename + ext
      const tmp = path.join(GC, crypto.hash(Buffer.from(link + key)).toString('hex'))
      const build = plink.serialize({ ...parsed, pathname: key })

      this.push({ tag: 'app', data: { app: filename, name, version, upgrade, key, tmp, dest } })

      await opwait(ipc.dump({ link: build, dir: tmp, force: true }), ({ tag, data }) => {
        if (tag !== 'final') this.push({ tag, data })
      })

      const from = path.join(tmp, 'by-arch', host, 'app', filename + ext)

      if (fs.existsSync(from) === false) {
        this.final = { data: { success: false, notFound: key } }
        return
      }

      if (isWindows) {
        const MSIXManager = require('msix-manager')
        await new MSIXManager().addPackage(from)
        installed++
        continue
      }

      if (isBin) {
        try {
          if (!to) fs.mkdirSync(path.dirname(dest), { recursive: true })
          this._move(from, dest)
        } catch (err) {
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            this.final = { data: { success: false, permission: true, dest } }
            return
          }
          throw err
        }
        fs.chmodSync(dest, 0o755)
      } else {
        try {
          await fs.promises.rename(from, dest)
        } catch (err) {
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            this.final = { data: { success: false, permission: true, dest } }
            return
          }
          throw err
        }
        if (isLinux) await this._linux(dest, filename, tmp, home)
      }
      fs.rmSync(tmp, { recursive: true, force: true })
      installed++
    }

    this.final = { data: { success: installed > 0, exists } }
  }

  async _linux(dest, appName, tmp, home) {
    fs.chmodSync(dest, 0o755)
    const extracted = path.join(tmp, 'squashfs-root')
    const desktopPath = this._extract(dest, extracted, tmp, appName + '.desktop')
    const desktop = fs.readFileSync(desktopPath, 'utf8').replace(/^Exec=.*/m, `Exec=${dest}`)
    fs.writeFileSync(desktopPath, desktop)

    spawnSync(dest, ['--appimage-extract', 'usr/share/icons'], { cwd: tmp })
    const src = new LocalDrive(path.join(extracted, 'usr', 'share', 'icons', 'hicolor'), {
      followLinks: true
    })
    const dst = new LocalDrive(path.join(home, '.local', 'share', 'icons', 'hicolor'))
    const mirror = src.mirror(dst, { prune: false })
    await mirror.done()

    this._move(
      desktopPath,
      path.join(home, '.local', 'share', 'applications', appName + '.desktop')
    )
  }

  _extract(appImage, extracted, cwd, file) {
    const { status } = spawnSync(appImage, ['--appimage-extract', file], { cwd })
    if (status !== 0) throw new Error('appimage-extract failed')
    const full = path.join(extracted, file)
    let stat = null
    try {
      stat = fs.lstatSync(full)
    } catch {}
    if (stat !== null && !stat.isSymbolicLink()) return full
    const link = fs.readlinkSync(full)
    const target = path.resolve(path.dirname(full), link)
    let exists = true
    try {
      fs.lstatSync(target)
    } catch {
      exists = false
    }
    return exists
      ? target
      : this._extract(appImage, extracted, cwd, path.relative(extracted, target))
  }

  _move(src, dst) {
    try {
      fs.renameSync(src, dst)
    } catch (err) {
      if (err.code === 'ENOENT') return // ignore if path does not exist
      if (err.code !== 'EXDEV') throw err
      fs.copyFileSync(src, dst)
      fs.rmSync(src)
    }
  }
}

module.exports = async function (cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, only, to } = cmd.flags
  const link = cmd.args.link
  const stream = new Install(ipc, { link, only, to })
  await output(json, stream)
}
