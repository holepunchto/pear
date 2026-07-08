'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')
const findVanityKey = require('../lib/vanity.js')
const z32 = require('z32')

const output = outputter('touch', {
  final: ({ link }) => {
    return {
      output: 'print',
      success: Infinity, // omit success ansi tick
      message: link
    }
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = async function touch(cmd) {
  const vanity = cmd.flags.vanity

  if (vanity) {
    try {
      z32.decode(vanity)
    } catch (e) {
      throw new Error(`Vanity key must contain only z32 characters (${e.message})`)
    }

    if (vanity.length > 4) {
      console.warn(
        'Warning: Vanity strings longer than 4 characters may take a long time to generate.'
      )
    }
  }

  const keyPair = vanity ? await findVanityKey(vanity) : undefined
  const ipc = context.getIPC()
  const json = cmd.flags.json
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.touch({ keyPair }))
}
