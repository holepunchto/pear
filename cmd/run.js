'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { fileURLToPath } = require('url-file-url')
const { outputter, print, InputError, stdio } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('run', {
  exit: ({ code }) => Bare.exit(code),
  stdout: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.out.write(data)) : stdio.out.write(data),
  stderr: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.err.write(data)) : stdio.err.write(data),
  loaded: (data, { loading }) => loading && loading.clear(data.forceClear || false)
})

module.exports = (ipc) => async function run (args, devrun = false) {
  let dir = null
  try {
    const { json, dev, _ } = parse.args(args, { boolean: ['json', 'dev'], default: { json: false, dev: false } })
    if (!_[0]) {
      if (devrun) {
        _[0] = '.'
        args.push(_[0])
      } else {
        throw new InputError('Missing argument: pear run <key|dir|alias>')
      }
    }
    if (_[0].startsWith('pear:') && _[0].slice(5, 7) !== '//') {
      throw new InputError('Key must start with pear://')
    }
    const key = parse.runkey(_[0]).key
    if (key !== null && _[0].startsWith('pear://') === false) {
      throw new InputError('Key must start with pear://')
    }
    const cwd = os.cwd()
    dir = key == null ? (_[0].startsWith('file:') ? fileURLToPath(_[0]) : _[0]) : cwd

    if (path.isAbsolute(dir) === false) {
      const resolved = path.resolve(cwd, dir)
      dir = args[args.indexOf(dir)] = resolved
    }
    if (dir !== cwd) os.chdir(dir)
    if (key === null) {
      try {
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))
      } catch (err) {
        throw new InputError(`A valid package.json file must exist at: "${dir}"`, { showUsage: false })
      }
    }

    await output(json, ipc.run({ key, args, dev, dir }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      if (err.showUsage) await ipc.usage.output('run')
    } else if (err.code === 'ENOENT') {
      print(err.message[0].toUpperCase() + err.message.slice(1) + ': "' + dir + '"', false)
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
