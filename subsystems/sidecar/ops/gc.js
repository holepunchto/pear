'use strict'
const { isWindows } = require('which-runtime')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { PLATFORM_DIR } = require('../../../constants.js')
const { ERR_INVALID_GC_RESOURCE, ERR_INVALID_INPUT, ERR_NOT_FOUND } = require('pear-errors')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const crypto = require('hypercore-crypto')
const plink = require('pear-link')

module.exports = class GC extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  #op(params) {
    if (params.resource === 'releases') return this.releases(params)
    if (params.resource === 'sidecars') return this.sidecars(params)
    if (params.resource === 'cores') return this.cores(params)
    throw ERR_INVALID_GC_RESOURCE('Invalid resource to gc: ' + params.resource)
  }

  async releases(params) {
    const { resource } = params
    let count = 0
    const symlinkPath = path.join(PLATFORM_DIR, 'current')
    const dkeyDir = path.join(PLATFORM_DIR, 'by-dkey')

    try {
      await fs.promises.stat(dkeyDir)
    } catch {
      this.push({ tag: 'complete', data: { resource, count } })
      return
    }

    const current = await fs.promises.readlink(symlinkPath)
    const currentDirPath = path.dirname(current)
    const currentDirName = path.basename(currentDirPath)

    const dirs = await fs.promises.readdir(dkeyDir, { withFileTypes: true })

    const dirNames = dirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)

    for (const dirName of dirNames) {
      if (dirName !== currentDirName) {
        const dirPath = path.join(dkeyDir, dirName)
        await fs.promises.rm(dirPath, { recursive: true })
        this.push({ tag: 'remove', data: { resource, id: dirName } })
        count++
      }
    }
    this.push({ tag: 'complete', data: { resource, count } })
  }

  sidecars(params) {
    const { resource, data = {} } = params
    const { pid } = data
    const name = 'pear-runtime'
    const flag = '--sidecar'

    const [sh, args] = isWindows
      ? [
          'cmd.exe',
          [
            '/c',
            `wmic process where (name like '%${name}%') get name,executablepath,processid,commandline /format:csv`
          ]
        ]
      : ['/bin/sh', ['-c', `ps ax | grep -i -- '${name}' | grep -i -- '${flag}'`]]

    const sp = spawn(sh, args)
    let output = ''
    let pidIndex = isWindows ? -1 : 0
    let isHeader = !!isWindows
    let count = 0

    sp.stdout.on('data', (data) => {
      output += data.toString()
      const lines = output.split(isWindows ? '\r\r\n' : '\n')
      output = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        const columns = line.split(isWindows ? ',' : ' ').filter((col) => col)
        if (isHeader && isWindows) {
          const index = columns.findIndex((col) => /processid/i.test(col.trim()))
          pidIndex = index !== -1 ? index : 4
          isHeader = false
        } else {
          const id = parseInt(columns[pidIndex])
          if (!isNaN(id) && ![Bare.pid, sp.pid, pid].includes(id)) {
            os.kill(id)
            this.push({ tag: 'remove', data: { resource, id } })
            count++
          }
        }
      }
    })

    return new Promise((resolve, reject) => {
      sp.on('exit', (code, signal) => {
        if (code !== 0 || signal) {
          reject(new Error(`Process exited with code: ${code}, signal: ${signal}`))
          return
        }
        this.push({ tag: 'complete', data: { resource, count } })
        resolve()
      })
    })
  }

  async cores(params) {
    const { resource, data = {} } = params
    const { link } = data
    const { sidecar } = this

    if (!link) throw ERR_INVALID_INPUT('A link must be specified')

    let parsed = null
    try {
      parsed = plink.parse(link)
    } catch {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    if (parsed.drive.key === null) {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }

    const metadataDiscoveryKey = crypto.discoveryKey(parsed.drive.key)
    const metadataInfo = await sidecar.corestore.storage.getInfo(metadataDiscoveryKey)
    if (!metadataInfo || (metadataInfo.auth && metadataInfo.auth.keyPair)) return

    const drive = new Hyperdrive(sidecar.getCorestore(), parsed.drive.key)
    try {
      await this.session.add(drive)
    } catch {
      await drive.close()
      throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
    }
    if (!drive.blobs) throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
    const contentDiscoveryKey = drive.blobs.core.discoveryKey
    await drive.close()

    const coreInfos = [await sidecar.corestore.storage.getInfo(contentDiscoveryKey), metadataInfo]
    const dlink = plink.serialize({ drive: { key: parsed.drive.key } })
    for (const coreInfo of coreInfos) {
      if (!coreInfo || (coreInfo.auth && coreInfo.auth.keyPair)) continue

      const core = await this.session.add(
        sidecar.corestore.get({
          discoveryKey: coreInfo.discoveryKey,
          active: false
        })
      )
      await core.clear(0, core.length)
      this.push({
        tag: 'remove',
        data: {
          operation: 'clear',
          resource: resource,
          id: hypercoreid.encode(coreInfo.discoveryKey),
          link: dlink
        }
      })
      await core.close()
    }
    await sidecar.corestore.storage.compact()
  }
}
