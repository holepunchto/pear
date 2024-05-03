'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { fileURLToPath } = require('url-file-url')
const { outputter, trust, stdio } = require('./iface')
const parse = require('../lib/parse')
const { ERR_INVALID_INPUT } = require('../lib/errors')

const output = outputter('run', {
  exit: ({ code }) => Bare.exit(code),
  stdout: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.out.write(data)) : stdio.out.write(data),
  stderr: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.err.write(data)) : stdio.err.write(data),
  loaded: (data, { loading }) => loading && loading.clear(data.forceClear || false)
})

module.exports = (ipc) => async function run (cmd, devrun = false) {
  let dir = null
  let key = null
  try {
    const { json, detached, store } = cmd.flags

    if (devrun && !cmd.args.link) cmd.args.link = '.'

    key = parse.runkey(cmd.args.link).key

    if (key !== null && cmd.args.link.startsWith('pear://') === false) {
      throw new ERR_INVALID_INPUT('Key must start with pear://')
    }

    const cwd = os.cwd()
    dir = key === null ? (cmd.args.link.startsWith('file:') ? fileURLToPath(cmd.args.link) : cmd.args.link) : cwd
    if (path.isAbsolute(dir) === false) dir = path.resolve(cwd, dir)
    if (dir !== cwd) os.chdir(dir)

    if (key === null) {
      try {
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))
      } catch (err) {
        throw new ERR_INVALID_INPUT(`A valid package.json file must exist at: "${dir}"`, { showUsage: false })
      }
    }
    const args = Bare.argv.slice(2)
    await output(json, await require('../run')({ flags: cmd.flags, link: cmd.args.link, appArgs: cmd.rest, ipc, key, args, dir, storage: store, detached }))
  } catch (err) {
    if (err.code !== 'ERR_PERMISSION_REQUIRED') throw err
    await trust({ ipc, key, message: err.message })
  }
}
