'use strict'
const hypercoreid = require('hypercore-id-encoding')
const byteSize = require('tiny-byte-size')
const { isWindows } = require('which-runtime')
const stdio = require('../lib/stdio')
const Interact = require('../lib/interact')
const { CHECKOUT } = require('../constants')
const ADD = 1
const REMOVE = -1
const CHANGE = 0

const pt = (arg) => arg
const es = () => ''
const ansi = isWindows
  ? { bold: pt, dim: pt, italic: pt, underline: pt, inverse: pt, red: pt, green: pt, yellow: pt, gray: pt, upHome: es, link: pt }
  : {
      bold: (s) => `\x1B[1m${s}\x1B[22m`,
      dim: (s) => `\x1B[2m${s}\x1B[22m`,
      italic: (s) => `\x1B[3m${s}\x1B[23m`,
      underline: (s) => `\x1B[4m${s}\x1B[24m`,
      inverse: (s) => `\x1B[7m${s}\x1B[27m`,
      red: (s) => `\x1B[31m${s}\x1B[39m`,
      green: (s) => `\x1B[32m${s}\x1B[39m`,
      yellow: (s) => `\x1B[33m${s}\x1B[39m`,
      gray: (s) => `\x1B[90m${s}\x1B[39m`,
      upHome: (n = 1) => `\x1B[${n}F`,
      link: (url, text = url) => `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`
    }

ansi.sep = isWindows ? '-' : ansi.dim(ansi.green('∞'))
ansi.tick = isWindows ? '^' : ansi.green('✔')
ansi.cross = isWindows ? 'x' : ansi.red('✖')
ansi.pear = isWindows ? '*' : '🍐'
ansi.dot = isWindows ? '•' : 'o'

function status (msg, success) {
  msg = msg || ''
  const done = typeof success === 'boolean'
  if (msg) stdio.out.write(`${indicator(success)}${msg}\n${done ? '' : ansi.upHome()}`)
}

function print (message, success) {
  console.log(`${typeof success !== 'undefined' ? indicator(success) : ''}${message}`)
}

function byteDiff ({ type, sizes, message }) {
  sizes = sizes.map((size) => (size > 0 ? '+' : '') + byteSize(size)).join(', ')
  print(indicator(type, 'diff') + ' ' + message + ' (' + sizes + ')')
}

function diff ({ prefix = '', suffix = '', add, remove, change, success }) {
  status(prefix + indicator(ADD, 'diff') + add + ' ' + indicator(REMOVE, 'diff') + remove + ' ' + indicator(CHANGE, 'diff') + change + suffix, success)
}

function indicator (value, type = 'success') {
  if (value === true) value = 1
  else if (value === false) value = -1
  else if (value == null) value = 0
  if (type === 'diff') return value === 0 ? ansi.yellow('~') : (value === 1 ? ansi.green('+') : ansi.red('-'))
  return value < 0 ? ansi.cross + ' ' : (value > 0 ? ansi.tick + ' ' : ansi.gray('- '))
}

const outputter = (cmd, taggers = {}) => async (json, stream, info = {}) => {
  let error = null
  if (Array.isArray(stream)) stream = asyncIterate(stream)
  try {
    for await (const { tag, data = {} } of stream) {
      if (json) {
        print(JSON.stringify({ cmd, tag, data }))
        continue
      }
      let result = null
      try {
        result = typeof taggers[tag] === 'function' ? taggers[tag](data, info) : (taggers[tag] || false)
      } catch (err) {
        error = err
        break
      }
      if (result === undefined) continue
      if (typeof result === 'string') result = { output: 'print', message: result }
      if (result === false) {
        if (tag === 'final') result = { output: 'print', message: data.success ? 'Success\n' : 'Failure\n' }
      }
      const { output, message, success = data.success } = result
      if (output === 'print') print(message, success)
      if (output === 'status') status(message, success)
      if (tag === 'diff') diff(data)
      if (tag === 'byte-diff') byteDiff(data)
    }
  } finally {
    if (error) throw error // eslint-disable-line no-unsafe-finally
  }
}

function asyncIterate (array) { return (async function * () { yield * array }()) }

const banner = `${ansi.bold('Pear')} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
const version = `${CHECKOUT.fork || 0}.${CHECKOUT.length || 'dev'}.${CHECKOUT.key}`
const header = `  ${banner}
  ${ansi.pear + ' '}${ansi.bold(ansi.gray('v' + version))}
`
const urls = ansi.link('https://pears.com', 'pears.com') + ' | ' + ansi.link('https://holepunch.to', 'holepunch.to') + ' | ' + ansi.link('https://keet.io', 'keet.io')

const footer = {
  overview: `  ${ansi.bold('Legend:')} [arg] = optional, <arg> = required, | = or \n  Run ${ansi.bold('pear help')} to output full help for all commands\n  For command help: ${ansi.bold('pear help [cmd]')} or ${ansi.bold('pear [cmd] -h')}\n
${ansi.pear + ' '}${version}\n${urls}\n${ansi.bold(ansi.dim('Pear'))} ~ ${ansi.dim('Welcome to the IoP')}`,
  help: `${ansi.pear + ' '}${version}
${urls}\n${ansi.bold(ansi.dim('Pear'))} ~ ${ansi.dim('Welcome to the IoP')}
  `
}

const descriptions = {
  release: `Set production release version.

Set the release pointer against a version (default latest).

Use this to indicate production release points.`,

  stage: `Channel name must be specified on first stage,
in order to generate the initial key.

Outputs diff information and project key.`,

  run: `${ansi.bold('link')}   pear://<key> | pear://<alias>
${ansi.bold('dir')}    file://<absolute-path> | <absolute-path> | <relative-path>`,

  seed: `Specify channel or key to seed a project.

Specify a remote key to reseed.`,

  info: `Supply a key or channel to view application information.

Supply no argument to view platform information.`,

  sidecar: `The Pear Sidecar is a local-running HTTP and IPC server which
provides access to corestores.

This command instructs any existing sidecar process to shutdown
and then becomes the sidecar.`,

  dev: `Alias for: ${ansi.italic('pear run --dev <dir>')}`

}

const usage = { header, version, banner, descriptions, footer }

async function trust ({ ipc, key, message }) {
  const z32 = hypercoreid.encode(key)
  const sure = ansi.cross +
    ' Key pear://' + z32 + ' is not known\n' +
    '\nBe sure that software is trusted before running it\n' +
    '\nType "TRUST" to allow execution or anything else to exit\n\n'

  const prompt = new Interact(sure, [
    {
      name: 'trust',
      default: '',
      prompt: 'Trust application',
      delim: '?',
      validation: (value) => !(value.toLowerCase() !== 'trust' && value === 'TRUST'),
      msg: ansi.cross + ' uppercase TRUST to confirm'
    }
  ])
  const result = await prompt.run()
  if (result.trust === 'TRUST') {
    await ipc.trust(key)
    print('\n' + ansi.tick + ' pear://' + z32 + ' is now trusted\n')
    print('Use pear run again to execute trusted application\n')
    await ipc.close()
    Bare.exit()
  } else {
    print('')
    print(message + '\n', false)
    await ipc.close()
    Bare.exit(77)
  }
}

module.exports = { usage, trust, stdio, ansi, indicator, status, print, byteDiff, diff, outputter }
