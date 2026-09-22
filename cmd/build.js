'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const pearBuild = require('pear-build')
const { ERR_NOT_FOUND } = require('pear-errors')
const { outputter, ansi } = require('../lib/terminal.js')

const output = outputter('build', {
  final: ({ name, version, target, executables }) => {
    let msg = `\n${ansi.pear} Build complete!\n\n`
    msg += `${ansi.bold('App:')}         ${name}\n`
    msg += `${ansi.bold('Version:')}     ${version}\n`
    msg += `${ansi.bold('Target:')}      ${target}\n`
    if (executables?.length) {
      msg += `\n${ansi.bold('Executables:')}\n`
      for (const item of executables) {
        msg += `  - ${item.file} (${ansi.dim('origin:')} ${item.origin})\n`
      }
    }
    return {
      output: 'print',
      success: Infinity,
      message: msg
    }
  }
})

module.exports = async function build(cmd) {
  const json = cmd.flags.json
  const builder = pearBuild(cmd.flags)
  builder.on('error', () => {})

  const executables = new Set()
  builder.on('mirrored', ({ from, to }) => {
    executables.add({
      file: path.resolve(to, path.basename(from)),
      origin: from
    })
  })

  await builder.done()

  const pkgPath = path.resolve(cmd.flags.package)
  let pkg
  try {
    pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'))
  } catch (err) {
    throw ERR_NOT_FOUND(`Unable to read package.json at ${pkgPath}: ${err.message}`, {
      path: pkgPath,
      cause: err
    })
  }

  const name = pkg.name || pkg.productName || ''
  const version = pkg.version || ''
  const target = path.resolve(cmd.flags.target || `${name}-${version}`)

  const data = {
    success: true,
    name,
    version,
    target,
    executables: [...executables]
  }

  await output(json, [{ tag: 'final', data }])
}
