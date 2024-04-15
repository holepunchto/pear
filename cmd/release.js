'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, print, ansi } = require('./iface')
const parse = require('../lib/parse')
const { INPUT_ERROR } = require('../lib/errors')

const output = outputter('release', {
  releasing: ({ name, channel }) => `\n${ansi.pear} Releasing ${name} [ ${channel} ]\n`,
  'updating-to': ({ releaseLength, currentLength }) => `Current length is ${currentLength}\nSetting release to ${releaseLength}\n`,
  released: ({ name, channel, length }) => `The ${name} app (${channel} channel) was successfully released.\nLatest length: ${length}\n`,
  final: { output: 'print', message: 'Release complete\n', success: true }
})

module.exports = (ipc) => async function release (args) {
  const { _, checkout, name, json } = parse.args(args, { boolean: ['json'], string: ['name', 'checkout'] })
  try {
    const [from] = _
    let [, dir = ''] = _
    const isKey = parse.runkey(from.toString()).key !== null
    const channel = isKey ? null : from
    const key = isKey ? from : null
    if (!channel && !key) throw INPUT_ERROR('A key or the channel name must be specified.')

    if (isAbsolute(dir) === false) dir = resolve(os.cwd(), dir)
    if (checkout !== undefined && Number.isInteger(+checkout) === false) {
      throw INPUT_ERROR('--checkout flag must supply an integer if set')
    }
    const id = Bare.pid
    await output(json, ipc.release({ id, name, channel, key, checkout, dir }))
  } catch (err) {
    if (err.code === 'ERR_INPUT' || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      ipc.userData.usage.output('release', false)
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  } finally {
    await ipc.close()
  }
}
