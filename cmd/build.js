'use strict'
const path = require('bare-path')
const { outputter, print, InputError } = require('./iface')
const parse = require('../lib/parse')
const output = outputter('build', {
  starting: ({ platform, arch, key, dir }) => `Starting build for pear://${key} on ${platform}-${arch} in ${dir}`,
  dumping: ({ key, dir }) => `Dumping ${key} into ${dir}`,
  initializing: () => 'Initializing...',
  cmakeCreated: () => '  Generated CMakeLists.txt from package.json',
  cmakeExists: () => '  Using existing CMakeLists.txt',
  configuring: () => 'Configuring...',
  building: () => 'Building...',
  done: ({ key, dir }) => `Build complete for pear://${key} in ${dir}`,
  error: ({ code, stack }) => `Build Error (code: ${code || 'none'}) ${stack}`,
  stdout: (data) => `  ${data?.trimEnd()?.split('\n')?.join('\n  ')}`,
  stderr: (data) => `  ${data?.trimEnd()?.split('\n')?.join('\n  ')}`,
})

module.exports = (ipc) => async function build (args) {
  try {
    const { _: [passedKey, buildDirArg], json } = parse.args(args, { boolean: ['json'] })

    const key = parse.runkey(passedKey)?.key?.z32
    if (!key) throw new InputError(passedKey ? `Key "${passedKey}" is not valid` : 'Key must be specified')
    if (!buildDirArg) throw new InputError('Build directory must be specified')

    const dir = path.resolve(buildDirArg)

    await output(json, ipc.build({ key, dir }))
  } catch (err) {
    if (err instanceof InputError) {
      ipc.userData.usage.output('build')
      print(err.message, false)
    } else {
      console.error(err)
    }
  } finally {
    await ipc.close()
  }
}
