'use strict'
const context = require('../context')
const { outputter, ansi, byteSize } = require('../lib/terminal.js')

const TYPES = ['core', 'blobs']
const TYPE_WIDTH = Math.max(...TYPES.map((type) => type.length))

const output = outputter('cores', {
  core: (data, info) => {
    info.cores.push(data)
  },
  final: ({ count, writable, byteLength }, info) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message:
      count > 0
        ? [
            ...table(info.cores),
            `Total cores: ${count}${ansi.gray(` (writable: ${writable})`)}\nTotal size:  ${byteSize(byteLength)}`
          ]
        : '[ No cores ]'
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
  cores = sort(cores)
  const nameWidth = cores.reduce(
    (max, { name }) => Math.max(max, label(name).length),
    'NAME'.length
  )
  const linkWidth = cores.reduce((max, { link }) => Math.max(max, link.length), 'LINK'.length)
  const lengthWidth = cores.reduce(
    (max, { length }) => Math.max(max, String(length).length),
    'LENGTH'.length
  )
  const sizeWidth = cores.reduce(
    (max, { byteLength }) => Math.max(max, byteSize(byteLength).length),
    'SIZE'.length
  )
  const header = `${'NAME'.padEnd(nameWidth)}  ${'TYPE'.padEnd(TYPE_WIDTH)}  ${'LINK'.padEnd(linkWidth)}  ${'LENGTH'.padEnd(lengthWidth)}  WRITABLE  ${'SIZE'.padEnd(sizeWidth)}`
  const separator = ansi.gray('─'.repeat(header.length + 2))
  return [
    '\n ' + ansi.bold(header),
    separator,
    ...cores.map(({ link, name, blobs, drive, length, writable, byteLength }, index) => {
      const type = blobs ? 'blobs' : 'core'
      const nameLabel = label(name).padEnd(nameWidth)
      const sizeLabel = byteSize(byteLength).padEnd(sizeWidth)
      const prefix = index > 0 && drive !== cores[index - 1].drive ? separator + '\n' : ''
      const writableLabel = (writable ? '✔' : '').padEnd('WRITABLE'.length)
      const row = `${nameLabel}  ${type.padEnd(TYPE_WIDTH)}  ${link.padEnd(linkWidth)}  ${String(length).padEnd(lengthWidth)}  `
      if (blobs) {
        return `${prefix} ${ansi.gray(row + writableLabel + '  ' + sizeLabel)}`
      }
      return `${prefix} ${row}${writableLabel}  ${sizeLabel}`
    }),
    separator
  ]
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
