'use strict'
const { spawnSync } = require('bare-subprocess')
const fs = require('bare-fs')
const os = require('bare-os')
const make = require('bare-make')
const Opstream = require('../lib/opstream')

module.exports = class Build extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, dir } = {}) {
    this.push({ tag: 'init', data: { link, dir } })

    const repoDir = dir + '/pear-appling'
    try {
      fs.statSync(repoDir)
    } catch {
      const result = spawnSync('git', ['clone', 'https://github.com/holepunchto/pear-appling'], { cwd: dir, stdio: 'inherit' })
      if (result.status !== 0) throw new Error(`git exited with code ${result.status}: ${result.stderr?.toString()}`)
    }
    os.chdir(repoDir)

    this.push({ tag: 'npm', data: {} })
    const result = spawnSync('npm', ['i'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`npm exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'generate', data: {} })
    await make.generate()

    this.push({ tag: 'build', data: {} })
    await make.build()

    this.push({ tag: 'complete', data: { dir } })
  }
}
