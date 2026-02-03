'use strict'
const { isWindows } = require('which-runtime')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { PLATFORM_DIR } = require('pear-constants')
const { ERR_INVALID_GC_RESOURCE } = require('pear-errors')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')

module.exports = class GC extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  #op(params) {
    if (params.resource === 'releases') return this.releases(params)
    if (params.resource === 'sidecars') return this.sidecars(params)
    if (params.resource === 'assets') return this.assets(params)
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

    const dirNames = dirs
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

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
      : [
          '/bin/sh',
          ['-c', `ps ax | grep -i -- '${name}' | grep -i -- '${flag}'`]
        ]

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
          const index = columns.findIndex((col) =>
            /processid/i.test(col.trim())
          )
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
          reject(
            new Error(`Process exited with code: ${code}, signal: ${signal}`)
          )
          return
        }
        this.push({ tag: 'complete', data: { resource, count } })
        resolve()
      })
    })
  }

  async assets(params) {
    const { resource, data = {} } = params
    const { link } = data
    const { sidecar } = this
    await sidecar.ready()
    let count = 0
    let removeAssets = []
    if (link) {
      const asset = await sidecar.model.getAsset(link)
      if (asset) removeAssets = [asset]
    } else {
      const assets = await sidecar.model.allAssets()
      if (assets) removeAssets = assets
    }
    for (const { client } of sidecar.running.values()) {
      // skip running assets
      if (client.userData instanceof sidecar.App === false) return
      const links = Object.values(
        client.userData.state.manifest.pear?.assets ?? {}
      ).map((asset) => asset.link)
      removeAssets = removeAssets.filter((asset) => !links.includes(asset.link))
    }
    for (const asset of removeAssets) {
      await sidecar.model.removeAsset(asset.link)
      this.push({ tag: 'remove', data: { resource, id: asset.link } })
      count += 1
    }
    this.push({ tag: 'complete', data: { resource, count } })
  }

  async cores(params) {
    const { resource } = params
    const { sidecar } = this
    const ignore = !sidecar.drive.core
      ? new Set()
      : new Set([
          sidecar.drive.core.discoveryKey,
          sidecar.drive.blobs.core.discoveryKey
        ])

    for await (const discoveryKey of sidecar.corestore.list()) {
      if (ignore.has(hypercoreid.encode(discoveryKey))) continue
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)
      if (info.auth && info.auth.keyPair) continue
      const core = sidecar.corestore.get({
        discoveryKey: info.discoveryKey,
        active: false
      })
      await core.ready()
      await core.clear(0, core.length)
      this.push({
        tag: 'remove',
        data: {
          operation: 'cleared',
          resource: resource,
          id: hypercoreid.encode(discoveryKey)
        }
      })
      await core.close()
    }
    await sidecar.corestore.storage.compact()
  }
}
