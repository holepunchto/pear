'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const { Readable } = require('streamx')
const pearBuild = require('pear-build')
const { ERR_NOT_FOUND, ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, stdio } = require('../lib/terminal.js')

const output = outputter('build', {
  building: ({ name, version, target }) => {
    let msg = `\n${ansi.pear} Building ${name}\n\n`
    msg += `${ansi.bold('App:')}      ${name}\n`
    msg += `${ansi.bold('Version:')}  ${version}\n`
    msg += `${ansi.bold('Target:')}   ${target}\n`
    return msg
  },
  executable: ({ file, origin }) => {
    return `${ansi.green('+')} ${file} (${ansi.dim('origin:')} ${origin})`
  },
  final: () => {
    stdio.out.write('\n')
    return {
      output: 'print',
      success: Infinity,
      message: 'Build complete!'
    }
  }
})

module.exports = async function build(cmd) {
  const json = cmd.flags.json
  if (!cmd.flags.package) throw ERR_INVALID_INPUT('package.json path must be specified.')

  const pkgPath = path.resolve(cmd.flags.package)
  const pkg = await getParsedJSON('package.json', pkgPath)

  const name = pkg.name || pkg.productName || ''
  const version = pkg.version || ''
  const target = path.resolve(cmd.flags.target || `${name}-${version}`)

  const stream = new Readable()
  const outputPromise = output(json, stream)
  outputPromise.catch(() => {})

  stream.push({ tag: 'building', data: { name, version, target } })

  const builder = pearBuild(cmd.flags)
  builder.on('error', (err) => {
    stream.destroy(err)
  })

  builder.on('mirrored', ({ from, to }) => {
    stream.push({
      tag: 'executable',
      data: {
        file: path.resolve(to, path.basename(from)),
        origin: from
      }
    })
  })

  try {
    await builder.done()

    stream.push({ tag: 'final', data: { success: true } })
    stream.push(null)
    await outputPromise
  } catch (err) {
    stream.destroy(err)
    throw err
  }
}

async function getParsedJSON(name, path) {
  const file = await fs.promises.readFile(path, 'utf8').catch((err) => {
    if (err.code === 'ENOENT') {
      throw ERR_NOT_FOUND(name + ' not found', { path, cause: err })
    }
    if (err.code === 'EISDIR') {
      throw ERR_INVALID_INPUT(name + ' must be a file', { path, cause: err })
    }
    throw err
  })

  try {
    return JSON.parse(file)
  } catch (err) {
    throw ERR_INVALID_INPUT(name + ' is not a valid JSON', { path, cause: err })
  }
}
