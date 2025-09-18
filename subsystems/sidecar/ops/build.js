'use strict'
const { spawnSync } = require('bare-subprocess')
const fs = require('bare-fs')
// const make = require('bare-make')
const Opstream = require('../lib/opstream')

module.exports = class Build extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, dir }) {
    const repoDir = dir + '/pear-appling'
    this.push({ tag: 'init', data: { dir: repoDir } })
    let result

    if (!fs.existsSync(repoDir)) {
      result = spawnSync('git', ['clone', 'https://github.com/holepunchto/pear-appling'], { cwd: dir, stdio: 'inherit' })
      if (result.status !== 0) throw new Error(`git exited with code ${result.status}: ${result.stderr?.toString()}`)
    }

    this.push({ tag: 'npm', data: {} })
    result = spawnSync('npm', ['i'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`npm exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'generate', data: {} })
    result = spawnSync('bare-make', ['generate'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`bare-make generate exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'build', data: {} })
    result = spawnSync('bare-make', ['build'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`bare-make build exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'complete', data: { dir: repoDir } })
  }
}
