'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const sodium = require('sodium-native')
const { outputter, password } = require('pear-terminal')
const { PLATFORM_DIR } = require('pear-constants')
const { decode } = require('hypercore-id-encoding')
const hs = require('hypercore-sign')

const output = outputter('sign', {
  final: ({ response }) => decode(response) + '\n'
})

module.exports = async function sign(cmd) {
  const { json } = cmd.flags
  const { request } = cmd.args
  const key = fs.readFileSync(path.join(PLATFORM_DIR, 'sign', 'default'))
  const input = await password()
  const pwd = sodium.sodium_malloc(Buffer.byteLength(input))
  pwd.write(input)
  const response = hs.sign(decode(request), key, pwd)
  await output(json, [{ tag: 'final', data: { response } }])
}
