'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { outputter, password } = require('pear-terminal')
const { PLATFORM_DIR } = require('pear-constants')

const output = outputter('sign', {})

module.exports = async function sign(cmd) {
  const { json } = cmd.flags
  const { request } = cmd.args
  const key = fs.readSync(path.join(PLATFORM_DIR, 'sign', 'default'))
  const pwd = await password()
  const signables = request // TODO: why isn't sign function just supporting request ?
  const signatures = sign(signables, key, pwd)
  await output(json, [{ tag: 'final', data: { signatures } }])
}
