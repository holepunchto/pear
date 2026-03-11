'use strict'
const { outputter } = require('pear-terminal')
const hs = require('hypercore-sign')
const output = outputter('sign', {})

module.exports = async function sign(cmd) {
  const { json } = cmd.flags
  const { request } = cmd.args
  await output(
    json,
    hs.sign(request) // TODO - hypercore-sign needs sign, and to be a stream/async gen
  )
}
