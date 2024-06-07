'use strict'
const { isWindows } = require('which-runtime')
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const streamx = require('streamx')
const { PLATFORM_DIR } = require('../../../../constants')
const { ERR_INVALID_GC_RESOURCE } = require('../../../errors')

module.exports = class GC extends streamx.Readable {
  constructor ({ pid, resource }, client) {
    super()
    this.client = client
    if (resource === 'releases') this.releases({ resource })
    else if (resource === 'sidecars') this.sidecars({ pid, resource })
    else throw ERR_INVALID_GC_RESOURCE('Invalid resource to gc: ' + resource)
  }

  _destroy (cb) {
    cb(null)
  }

  async releases ({ resource }) {
    try {
      let count = 0
      const symlinkPath = path.join(PLATFORM_DIR, 'current')
      const dkeyDir = path.join(PLATFORM_DIR, 'by-dkey')

      try { await fs.promises.stat(dkeyDir) } catch {
        this.push({ tag: 'complete', data: { resource, count } })
        this.push({ tag: 'final', data: { success: true } })
        this.push(null)
      }

      const current = await fs.promises.readlink(symlinkPath)
      const currentDirPath = path.dirname(current)
      const currentDirName = path.basename(currentDirPath)

      const dirs = await fs.promises.readdir(dkeyDir, { withFileTypes: true })

      const dirNames = dirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      for (const dirName of dirNames) {
        if (dirName !== currentDirName) {
          const dirPath = path.join(dkeyDir, dirName)
          await fs.promises.rm(dirPath, { recursive: true })
          this.push({ tag: 'remove', data: { resource, id: dirName } })
          count++
        }
      }
      this.push({ tag: 'complete', data: { resource, count } })
      this.push({ tag: 'final', data: { success: true } })
      this.push(null)
    } catch (error) {
      this.#error(error)
    }
  }

  sidecars ({ pid, resource }) {
    const name = 'pear-runtime'
    const flag = '--sidecar'

    const [sh, args] = isWindows
      ? ['cmd.exe', ['/c', `wmic process where (name like '%${name}%') get name,executablepath,processid,commandline /format:csv`]]
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
        const columns = line.split(isWindows ? ',' : ' ').filter(col => col)
        if (isHeader && isWindows) {
          const index = columns.findIndex(col => /processid/i.test(col.trim()))
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

    sp.on('exit', (code, signal) => {
      if (code !== 0 || signal) {
        this.#error(new Error(`Process exited with code: ${code}, signal: ${signal}`))
      }
      this.push({ tag: 'complete', data: { resource, count } })
      this.push({ tag: 'final', data: { success: true } })
      this.push(null)
    })
  }

  #error (err) {
    const { stack, code, message } = err
    this.push({ tag: 'error', data: { stack, code, message, success: false } })
    this.push({ tag: 'final', data: { success: false } })
    this.push(null)
  }
}
