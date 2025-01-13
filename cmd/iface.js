'use strict'
const hypercoreid = require('hypercore-id-encoding')
const byteSize = require('tiny-byte-size')
const { isWindows } = require('which-runtime')
const stdio = require('../lib/stdio')
const tty = require('bare-tty')
const Interact = require('../lib/interact')
const { CHECKOUT } = require('../constants')
const ADD = 1
const REMOVE = -1
const CHANGE = 0

const isTTY = tty.isTTY(0)

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
ansi.warning = isWindows ? '!' : '⚠️'
ansi.pear = isWindows ? '*' : '🍐'
ansi.dot = isWindows ? '•' : 'o'
ansi.key = isWindows ? '>' : '🔑'

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

const outputter = (cmd, taggers = {}) => async (json, stream, info = {}, ipc) => {
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
        result = typeof taggers[tag] === 'function' ? await taggers[tag](data, info, ipc) : (taggers[tag] || false)
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
  release: `Set the release pointer against a version (default latest).

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

  dev: `Alias for: ${ansi.italic('pear run --dev <dir>')}`,

  touch: 'Creates a Pear Link using channel name if provided or else a randomly generated channel name.',

  reset: 'Clears application storage for given application link”'
}

const usage = { header, version, banner, descriptions, footer }

async function trust (ipc, key, cmd) {
  const explain = {
    run: 'Be sure that software is trusted before running it\n' +
      '\nType "TRUST" to allow execution or anything else to exit\n\n',
    init: 'This template is encrypted.\n' +
      '\nEnter the password to init from the template.\n\n'
  }

  const act = {
    run: 'Use pear run again to execute trusted application',
    init: 'Use pear init again to initalize from trusted template'
  }

  const ask = {
    run: 'Trust application',
    init: 'Trust template'
  }

  const z32 = hypercoreid.encode(key)
  const dialog = ansi.cross + ' Key pear://' + z32 + ' is not known\n\n' + explain[cmd]
  const delim = '?'
  const validation = (value) => value === 'TRUST'
  const msg = '\n' + ansi.cross + ' uppercase TRUST to confirm\n'

  const interact = new Interact(dialog, [
    {
      name: 'value',
      default: '',
      prompt: ask[cmd],
      delim,
      validation,
      msg
    }
  ])

  await interact.run()
  await ipc.permit({ key })
  print('\n' + ansi.tick + ' pear://' + z32 + ' is now trusted\n')
  print(act[cmd] + '\n')
  await ipc.close()
  Bare.exit()
}

async function password (ipc, key, cmd) {
  const z32 = hypercoreid.normalize(key)

  const explain = {
    run: 'pear://' + z32 + ' is an encrypted application. \n' +
      '\nEnter the password to run the app.\n\n',
    stage: 'This application is encrypted.\n' +
        '\nEnter the password to stage the app.\n\n',
    seed: 'This application is encrypted.\n' +
        '\nEnter the password to seed the app.\n\n',
    dump: 'This application is encrypted.\n' +
        '\nEnter the password to dump the app.\n\n',
    init: 'This template is encrypted.\n' +
      '\nEnter the password to init from the template.\n\n',
    info: 'This application is encrypted.\n' +
      '\nEnter the password to retrieve info.\n\n'
  }

  const message = {
    run: 'Added encryption key for pear://' + z32,
    stage: 'Added encryption key, run stage again to complete it.',
    seed: 'Added encryption key, run seed again to complete it.',
    dump: 'Added encryption key, run dump again to complete it.',
    init: 'Added encryption key, run init again to complete it.',
    info: 'Added encryption key, run info again to complete it.'
  }

  const dialog = ansi.cross + ' ' + explain[cmd]
  const ask = 'Password'
  const delim = ':'
  const validation = (key) => key.length > 0
  const msg = '\nPlease, enter a valid password.\n'
  const interact = new Interact(dialog, [
    {
      name: 'value',
      default: '',
      prompt: ask,
      delim,
      validation,
      msg
    }
  ], { masked: true })
  const result = await interact.run()
  print(`\n${ansi.key} Hashing password...`)
  await ipc.permit({ key, password: result.value })
  print('\n' + ansi.tick + ' ' + message[cmd] + '\n')
  await ipc.close()
  Bare.exit()
}

function permit (ipc, info, cmd) {
  const key = info.key
  if (info.encrypted) {
    return password(ipc, key, cmd)
  } else {
    return trust(ipc, key, cmd)
  }
}

async function confirm (dialog, ask, delim, validation, msg) {
  const interact = new Interact(dialog, [
    {
      name: 'value',
      default: '',
      prompt: ask,
      delim,
      validation,
      msg
    }
  ])
  await interact.run()
}

module.exports = { usage, permit, stdio, ansi, indicator, status, print, byteDiff, diff, outputter, isTTY, confirm }
