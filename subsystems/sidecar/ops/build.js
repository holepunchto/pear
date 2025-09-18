'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { spawnSync } = require('bare-subprocess')
const fs = require('bare-fs')
const Opstream = require('../lib/opstream')
const Bundle = require('../lib/bundle')
// const make = require('bare-make')

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

    await this.sidecar.ready()
    const corestore = this.sidecar.getCorestore()
    await corestore.ready()

    const key = hypercoreid.decode(link)
    const bundle = new Bundle({
      swarm: this.sidecar.swarm,
      corestore,
      key
    })

    await bundle.ready()
    await bundle.join({ server: false })
    await bundle.drive.get('/package.json')

    let pkgBuf = await bundle.drive.get('/package.json')
    if (pkgBuf && pkgBuf.value) pkgBuf = pkgBuf.value
    const pkg = JSON.parse(Buffer.from(pkgBuf).toString())

    const build = pkg?.pear?.build
    if (!build) {
      this.push({ tag: 'error', data: { message: 'package.json requires field pear.build' } })
      return
    }

    const cmakeTxt = `
    cmake_minimum_required(VERSION 3.31)
    find_package(cmake-pear REQUIRED PATHS node_modules/cmake-pear)
    project(pear_appling C CXX ASM)

    add_pear_appling(
      pear_appling
      ID "${build.id}"
      NAME "${build.name}"
      LINK "${build.link}"
      VERSION ${build.version}
      AUTHOR "${build.author}"
      DESCRIPTION "${build.description}"
      MACOS_IDENTIFIER "${build.macos_identifier}"
      MACOS_CATEGORY "${build.macos_category}"
      MACOS_SIGNING_IDENTITY "${build.macos_signing_identity}"
      WINDOWS_SIGNING_SUBJECT "${build.windows_signing_subject}"
      WINDOWS_SIGNING_THUMBPRINT "${build.windows_signing_thumbprint}"
      LINUX_CATEGORY "${build.linux_category}"
    )`
    await fs.promises.writeFile(repoDir + '/CMakeLists.txt', cmakeTxt)

    this.push({ tag: 'generate', data: {} })
    result = spawnSync('bare-make', ['generate'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`bare-make generate exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'build', data: {} })
    result = spawnSync('bare-make', ['build'], { cwd: repoDir, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`bare-make build exited with code ${result.status}: ${result.stderr?.toString()}`)

    this.push({ tag: 'complete', data: { dir: repoDir } })
  }
}
