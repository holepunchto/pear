'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const TYPES = ['[core]', '[blobs]']
const TYPE_WIDTH = Math.max(...TYPES.map((type) => type.length))

const output = outputter('cores', {
  core: (data, info) => {
    info.cores.push(data)
  },
  final: ({ count, writable }, info) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message:
      count > 0
        ? [...table(info.cores), `Total cores: ${count} | Writable: ${writable}`]
        : 'No cores'
  }),
  error: ({ code, message, stack }) => `Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function cores(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  const allCores = cmd.flags.allCores
  await output(
    { json, ctrlTTY: false, log: (line) => console.log(line) },
    ipc.cores({ allCores }),
    { cores: [] }
  )
}

function table(cores) {
  const nameWidth = cores.reduce((max, { name }) => Math.max(max, label(name).length), 0)
  return sort(cores).map(({ link, name, blobs, length, writable }) => {
    const type = blobs ? '[blobs]' : '[core]'
    const meta = writable ? `(length: ${length}, writable)` : `(length: ${length})`
    return `${label(name).padEnd(nameWidth)} ${type.padEnd(TYPE_WIDTH)} ${link} ${meta}`
  })
}

function sort(cores) {
  const named = ({ name }) => (name === null ? 0 : 1)
  const cmp = (a, b) => (a === b ? 0 : a < b ? -1 : 1)

  return [...cores].sort(
    (a, b) =>
      named(b) - named(a) ||
      cmp(a.name, b.name) ||
      cmp(a.drive, b.drive) ||
      Number(a.blobs) - Number(b.blobs)
  )
}

function label(name) {
  return name || '-'
}
