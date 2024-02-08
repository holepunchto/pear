'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { outputter, print, InputError, stdio } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('run', {
  exit: ({ code }) => Bare.exit(code),
  stdout: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.out.write(data)) : stdio.out.write(data),
  stderr: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.err.write(data)) : stdio.err.write(data),
  loaded: (data, { loading }) => loading && loading.clear(data.forceClear || false)
})

module.exports = (ipc) => async function run (args) {
  try {
    const { json, dev, _ } = parse.args(args, { boolean: ['json', 'dev'], default: { json: false, dev: false } })
    const key = parse.runkey(_[0]).key
    const cwd = os.cwd()
    let dir = key == null ? (_[0] || '.') : cwd

    if (path.isAbsolute(dir) === false) {
      const resolved = path.resolve(cwd, dir)
      dir = args[args.indexOf(dir)] = resolved
    }
    if (dir !== cwd) os.chdir(dir)
    if (key === null) {
      try {
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))
      } catch (err) {
        throw new Error(`Pear: A valid package.json file must exist at ${dir}`, -1)
      }
    }

    await output(json, ipc.run({ key, args, dev, dir }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      await ipc.usage.output('run')
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
