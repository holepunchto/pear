'use strict'
const { outputter } = require('pear-terminal')

const output = outputter('keygen', {})

module.exports = async function keygen(cmd) {
  const { json } = cmd.flags
  await output(
    json,
    hs.keygen(request) // TODO - hypercore-sign needs keygen, and to be a stream/async gen
  )
}
