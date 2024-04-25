'use strict'
const os = require('bare-os')
const fs = require('bare-fs')
const path = require('bare-path')
const { fileURLToPath } = require('url-file-url')
const { outputter, print, InputError, stdio, interact, ansi } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('run', {
  exit: ({ code }) => Bare.exit(code),
  stdout: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.out.write(data)) : stdio.out.write(data),
  stderr: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.err.write(data)) : stdio.err.write(data),
  loaded: (data, { loading }) => loading && loading.clear(data.forceClear || false)
})

module.exports = (ipc) => async function run (cmd, devrun = false) {
  let dir = null
  let key = null
  let ask = false

  try {
    const { json, dev, detached, store, askTrust } = cmd.flags
    ask = askTrust

    if (devrun) {
      // todo inject . dir if no arg.link - check unparsed args for it
    }

    key = parse.runkey(cmd.args.link).key

    if (key !== null && cmd.args.link.startsWith('pear://') === false) {
      throw new InputError('Key must start with pear://')
    }

    const cwd = os.cwd()
    dir = key === null ? (cmd.args.link.startsWith('file:') ? fileURLToPath(cmd.args.link) : cmd.args.link) : cwd
    if (path.isAbsolute(dir) === false) dir = path.resolve(cwd, dir)
    if (dir !== cwd) os.chdir(dir)

    if (key === null) {
      try {
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))
      } catch (err) {
        throw new InputError(`A valid package.json file must exist at: "${dir}"`, { showUsage: false })
      }
    }

    const args = Bare.argv.slice(1)
    await output(json, await require('../lib/run')({ ipc, key, args, dev, dir, storage: store, detached }))
  } catch (err) {
    if (err.code === 'ERR_PERMISSION_REQUIRED') {
      if (ask === false) {
        Bare.exit(1)
        return
      }
      const sure = ansi.cross + ' Key pear://' + key?.z32 + ' is not known\n\nBe sure that software is trusted before running it\n\nType "TRUST" to allow execution or anything else to exit\n\n'
      const prompt = interact(sure, [
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
      if (result.fields.trust === 'TRUST') {
        await ipc.trust(key)
        print('\n' + ansi.tick + ' pear://' + key?.z32 + ' is now trusted\n')
        print('Use pear run again to execute trusted application\n')
      } else {
        print('')
        print(err.message + '\n', false)
      }
    } else if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      if (err.showUsage) ipc.userData.usage.output('run')
    } else if (err.code === 'ENOENT') {
      print(err.message[0].toUpperCase() + err.message.slice(1) + ': "' + dir + '"', false)
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
