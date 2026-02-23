'use strict'
const os = require('bare-os')
const plink = require('pear-link')
const tty = require('bare-tty')
const process = require('bare-process')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, permit, isTTY, byteSize, stdio } = require('pear-terminal')

class Table {
  constructor(data = [], opts = {}) {
    const { view, offset = 0, minPadding = 1, maxPadding = 5 } = opts
    this.data = data
    this.view = view
    this.offset = offset
    this.minPadding = minPadding
    this.maxPadding = maxPadding
  }
  get height() {
    if (this.data.length >= this.view) return this.view
    return this.data.length
  }
  get rows() {
    if (this.view === undefined) return this.data

    const rows = []
    for (let i = 0; i < this.height; i++) {
      if (i + this.offset >= this.data.length) break
      rows[i] = [''].concat(this.data[i + this.offset])
    }
    if (rows.length > 1) {
      if (this.offset > 0) {
        rows[0][0] = ansi.up
      }
      if (this.view + this.offset < this.data.length) {
        rows[rows.length - 1][0] = ansi.down
      }
    }

    return rows
  }
  push(row) {
    this.data.push(row)
    this.bottom()
  }
  bottom() {
    if (this.data.length > (this.view ?? 0)) {
      this.offset = this.data.length - (this.height ?? 0)
    } else {
      this.offset = 0
    }
  }
  up() {
    if (this.offset > 0) this.offset -= 1
  }
  down() {
    if (this.offset < this.data.length - (this.view ?? 0)) this.offset += 1
  }
  print() {
    const { width } = stdio.size()
    if (this.rows.length === 0) return ''

    const rows = this.rows.map((r) => r.map((c) => `${c}`))
    const firstRow = rows[0]
    const maxCols = rows.reduce(
      (maxCol, row) => row.map((val, i) => (maxCol[i] < val.length ? val.length : maxCol[i])),
      Array.from(firstRow, () => 0)
    )
    const maxLineLength = maxCols.reduce((prev, curr) => prev + curr, 0)
    const numCols = firstRow.length
    const padding = width ? Math.floor((width - (maxLineLength + 2)) / numCols) : ' '
    return rows
      .map(
        (row) =>
          ` ${row
            .map((col, i) => {
              let whiteSpaceCount = 0
              if (i !== numCols - 1) {
                whiteSpaceCount = maxCols[i] - col.length
                if (padding < this.minPadding) {
                  whiteSpaceCount += this.minPadding
                } else if (padding > this.maxPadding) {
                  whiteSpaceCount += this.maxPadding
                } else {
                  whiteSpaceCount += padding
                }
              }
              return `${col}${' '.repeat(whiteSpaceCount)}`
            })
            .join('')}`
      )
      .join('\n')
  }
}

const stats = new Table()
const peers = new Table([], { view: 5, maxPadding: 2 })

function printBorder() {
  const { width } = stdio.size()
  if (!width) return ''
  const borderLength = width - 2
  return ` ${'-'.repeat(borderLength)} `
}

function printOutput() {
  stdio.out.write([printBorder(), stats.print(), printBorder(), peers.print()].join('\n'))
}

function clearScreenAndScollback() {
  stdio.out.write(`\x1b[H\x1b[2J\x1b[3J`)
}

function clearScreen() {
  stdio.out.write(`\x1b[H\x1b[J`)
}

function displayOnResize() {
  clearScreenAndScollback()
  const { height } = stdio.size()
  if (height) {
    peers.view = height - stats.height - 3
    peers.bottom()
  }
  printOutput()
}

function display() {
  clearScreen()
  printOutput()
}

const output = outputter('seed', {
  announced: () => {
    peers.push(['^_^ announced'])
    display()
  },
  'peer-add': (info) => {
    peers.push([`o-o peer join ${info}`])
    display()
  },
  'peer-remove': (info) => {
    peers.push([`-_- peer drop ${info}`])
    display()
  },
  stats({ peers, key, discoveryKey, contentKey, link, firewalled, natType, upload, download }) {
    const p = `[ Peers: ${peers} ]`
    const ul = `[ ${ansi.up} ${byteSize(upload.totalBytes)} - ${byteSize(upload.speed)}/s ]`
    const dl = `[ ${ansi.down} ${byteSize(download.totalBytes)} - ${byteSize(download.speed)}/s ]`

    const isFirstDisplay = stats.data.length === 0

    stats.data = [
      [`Pear Seed`, `${ansi.pear} ${link}`],
      ['Drive Key', key ?? 0],
      ['Discovery Key', discoveryKey ?? ''],
      ['Content Key', contentKey ?? ''],
      ['Firewalled', firewalled ?? 'unknown'],
      ['NAT Type', natType ?? 'unknown'],
      ['Transfer', `${p} ${ul} ${dl}`]
    ]

    if (isFirstDisplay) displayOnResize()
    else display()
  },
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'seed')
    } else {
      return `Seed Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  }
})

module.exports = async function seed(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, verbose, ask } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const link = cmd.args.link
  if (!link || plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  }
  const { name } = cmd.flags
  const id = Bare.pid

  stdio.in?.setMode?.(tty.constants.MODE_RAW)
  stdio.in?.on('data', (key) => {
    if (key.toString() === '\u0003') {
      stdio.out.write(`\x1b[?25h`)
      setTimeout(() => {
        process.exit(0)
      }, 1)
    } else if (key.toString() === '\u001b[A') {
      peers.up()
    } else if (key.toString() === '\u001b[B') {
      peers.down()
    }
    clearScreen()
    printOutput()
  })
  stdio.out.off('resize', displayOnResize)
  stdio.out.on('resize', displayOnResize)

  await output(
    json,
    ipc.seed({
      id,
      name,
      link,
      verbose,
      dir,
      cmdArgs: Bare.argv.slice(1)
    }),
    { ask },
    ipc
  )
}
