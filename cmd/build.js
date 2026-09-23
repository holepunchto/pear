'use strict'
const path = require('bare-path')
const { Readable } = require('streamx')
const pearBuild = require('pear-build')
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

  const stream = new Readable()
  const outputPromise = output(json, stream)
  outputPromise.catch(() => {})

  const builder = pearBuild(cmd.flags)
  builder.on('error', (err) => {
    stream.destroy(err)
  })

  builder.on('building', ({ pkg, target }) => {
    stream.push({
      tag: 'building',
      data: {
        name: pkg.productName || pkg.name || '',
        version: pkg.version || '',
        target
      }
    })
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
