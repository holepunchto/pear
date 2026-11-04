'use strict'
const { ERR_OPERATION_FAILED } = require('pear-errors')
const { spawn } = require('bare-subprocess')
const Opstream = require('../lib/opstream')
const { waitForExit } = require('../../../lib/subprocess')

module.exports = class Make extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ cwd, entrypoint, host, pathDir, name, version }) {
    LOG.trace('make', 'starting', { cwd, entrypoint, host, pathDir, name, version })
    const pearMakeProcess = spawn(
      'pear-make',
      [
        ...(version ? ['--version'] : []),
        ...(host ? ['--host', host] : []),
        ...(pathDir ? ['--path', pathDir] : []),
        ...(name ? ['--name', name] : []),
        entrypoint
      ],
      {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      }
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
