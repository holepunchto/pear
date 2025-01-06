'use strict'
const { outputter } = require('./iface')

const listBundle = () => {
  console.log('List bundle')
}

const listAll = () => {
  listBundle()
}

const output = outputter('list', {
  bundle: listBundle,
  all: listAll
})

module.exports = (ipc) => async function list (cmd) {
  if (cmd.flags.bundle) {
    await output(false, [{ tag: 'bundle' }])
  } else {
    await output(false, [{ tag: 'all' }])
  }
}
