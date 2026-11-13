'use strict'
const { ERR_OPERATION_FAILED } = require('pear-errors')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const Opstream = require('../lib/opstream')
const { waitForExit } = require('../../lib/subprocess')
const { platform, arch } = require('which-runtime')

module.exports = class Make extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ entry, cwd, host, pathDir, name, version }) {
    LOG.trace('make', 'starting', { entry, cwd, host, pathDir, name, version })

    const distPath = pathDir
      ? path.join(pathDir, 'by-arch', host || platform + '-' + arch, 'app')
      : null
    console.log('distPath', distPath)

    const pearMakeProcess = spawn(
      'pear-make',
      [
        ...(version ? ['--version'] : []),
        ...(host ? ['--host', host] : []),
        ...(pathDir ? ['--path', distPath] : []),
        ...(name ? ['--name', name] : []),
        ...(entry ? [entry] : [])
      ],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'] }
    )

    pearMakeProcess.stdout.on('data', (chunk) => {
      this.push({ tag: 'make', data: { chunk: chunk.toString() } })
    })

    pearMakeProcess.stderr.on('data', (chunk) => {
      this.push({ tag: 'make', data: { chunk: chunk.toString() } })
    })

    const exitCode = await waitForExit(pearMakeProcess)
    if (exitCode !== 0) {
      throw ERR_OPERATION_FAILED(`pear-make failed with exit code ${exitCode}`)
    }
  }
}
