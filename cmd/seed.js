'use strict'
const os = require('bare-os')
const plink = require('pear-link')
const tty = require('bare-tty')
const process = require('bare-process')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, permit, isTTY, byteSize, stdio } = require('pear-terminal')
const { EventEmitter } = require('bare-events')

class Table extends EventEmitter {
  constructor(rows = [], opts = {}) {
    const { view, offset = 0, minPadding = 1, maxPadding = 5 } = opts
    super()
    rows.forEach((row) => {
      this.emit('row', Object.freeze([...row]))
    })
    /** do not modify _rows, use .append or .swap to alter table */
    this._rows = rows
    this.view = view
    this.offset = offset
    this.minPadding = minPadding
    this.maxPadding = maxPadding
  }
  swap(i, row) {
    this._rows[i] = row
    this.emit('row', Object.freeze([...row]))
  }
  get length() {
    return this._rows.length
  }
  get height() {
    if (this.view !== undefined && this.length >= this.view) return this.view
    return this.length
  }
  get canScrollUp() {
    return this.offset > 0
  }
  get canScrollDown() {
    return this.view + this.offset < this.length
  }
  get canScroll() {
    return this.canScrollUp || this.canScrollDown
  }
  append(row) {
    this.emit('row', Object.freeze([...row]))
    this._rows.push(row)
    this.bottom()
  }
  bottom() {
    if (this.length > (this.view ?? 0)) {
      this.offset = this.length - (this.height ?? 0)
    } else {
      this.offset = 0
    }
  }
  up() {
    if (this.offset > 0) this.offset -= 1
  }
  down() {
    if (this.offset < this.length - (this.view ?? 0)) this.offset += 1
  }
  _visible(opts = {}) {
    const { isSelected = false } = opts
    // if no view is set, always display all rows (no scrollbar)
    if (this.view === undefined) return this._rows

    const rowsToDisplay = []

    for (let i = 0; i < this.height; i++) {
      if (i + this.offset >= this._rows.length) break

      let scrollChar = ' '
      if (i === 0) {
        if (this.canScrollUp) {
          scrollChar = ansi.up
        }
      }
      if (i === this.height - 1) {
        if (this.canScrollDown) {
          scrollChar = ansi.down
        }
      }
      if (!isSelected) scrollChar = ansi.dim(scrollChar)
      rowsToDisplay[i] = [scrollChar].concat(this._rows[i + this.offset])
    }
    return rowsToDisplay
  }
  render({ screen, isSelected = false }) {
    const visible = this._visible({ isSelected })
    if (visible.length === 0) return []

    const rows = visible.map((r) => r.map((c) => `${c}`))
    const firstRow = rows[0]
    const maxCols = rows.reduce(
      (maxCol, row) =>
        row.map((val, i) => {
          if (i === 0) return 1
          return maxCol[i] < val.length ? val.length : maxCol[i]
        }),
      Array.from(firstRow, () => 0)
    )
    const maxLineLength = maxCols.reduce((prev, curr) => prev + curr, 0)
    const numCols = firstRow.length
    const padding = screen?.width ? Math.floor((screen?.width - maxLineLength) / numCols) : ' '

    const renderedRows = rows.map(
      (row) =>
        `${row
          .map((col, i) => {
            let whiteSpaceCount = 1
            if (i === 0) {
              if (this.canScroll) {
                whiteSpaceCount = 1
              }
            } else {
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
            }

            return `${col}${' '.repeat(whiteSpaceCount)}`
          })
          .join('')}`
    )

    return renderedRows
  }
}

class DictTable extends Table {
  constructor(config, opts = {}) {
    const configForKey = {}
    const rowForKey = {}
    const state = {}
    const rows = []

    config.forEach((c, i) => {
      rowForKey[c.key] = i
      configForKey[c.key] = c
      state[c.key] = c.initial
      rows.push([c.label, c.initial])
    })

    super(rows, opts)
    this.configForKey = configForKey
    this.rowForKey = rowForKey
    this.state = state
  }
  get(key) {
    return this.state[key]
  }
  update(dict) {
    for (const [key, val] of Object.entries(dict)) {
      this.set(key, val)
    }
  }
  set(key, val) {
    const config = this.configForKey[key]
    if (!config) throw new Error(`key ${key} not configured`)
    const i = this.rowForKey[key]
    const didChange = this.state[key] !== val
    this.state[key] = val

    if (didChange) {
      const { label, transform = (v) => v } = config
      this.swap(i, [label, transform(this.state[key])])
    }
  }
}

class TableLayout {
  constructor(elements, opts = {}) {
    this.appendMode = opts.appendMode ?? false
    this.elements = elements
    this.selected = null
    this.scrollableElements = []

    if (this.appendMode) {
      this.appendLog = []
      this.elements.forEach((element) => {
        if (element.type === 'table') {
          element.table.on('row', (row) => {
            this.appendLog.push(row)
          })
        }
      })
    }
  }
  get selectedTable() {
    if (!this.selected) return null
    const selectedElement = this.elements[this.selected]
    if (selectedElement.type !== 'table') return null
    return selectedElement.table
  }
  selectNextScrollable() {
    if (this.scrollableElements.length === 0) return
    if (!this.selected) {
      this.selected = this.scrollableElements[this.scrollableElements.length - 1]
    } else {
      const i = this.scrollableElements.indexOf(this.selected)
      this.selected = this.scrollableElements[(i + 1) % this.scrollableElements.length]
    }
  }
  print(stdio, opts) {
    const str = this.render({ ...opts, screen: stdio.size() })
    if (str) stdio.out.write(`${str}\n`)
  }
  render(opts = {}) {
    const { clearScrollback, screen } = opts
    const { appendMode } = this

    if (appendMode) {
      const rows = []
      while (this.appendLog.length > 0) {
        rows.push(this.appendLog.shift().join(' '))
      }
      return rows.join('\n')
    }

    let prefix = ''
    if (!appendMode) {
      if (clearScrollback) prefix = `\x1b[H\x1b[2J\x1b[3J`
      else prefix = `\x1b[H\x1b[J`
    }

    if (screen?.height) {
      // start by setting the view height of each table to the minimum height
      let renderedHeight = 0
      this.elements.forEach((element) => {
        if (element.type === 'table') {
          const { table, minHeight = 2, maximize } = element
          table.view = maximize ? table.length : minHeight
          renderedHeight += table.view
        } else if (element.type === 'border') {
          renderedHeight += 1
        }
      })
      ;(() => {
        while (renderedHeight < screen.height) {
          const renderedHeightBefore = renderedHeight
          for (let i = 0; i < this.elements.length; i++) {
            if (renderedHeight >= screen.height) return
            const element = this.elements[i]
            if (element.type === 'table') {
              const { maxHeight, table } = element
              if (table.length > table.view) {
                if (!maxHeight || table.view < maxHeight) {
                  table.view++
                  renderedHeight++

                  if (table.length - table.offset < table.view && table.offset > 0) {
                    table.offset--
                  }
                }
              }
            }
          }
          // if nothing can expand anymore to fill screen, we exit
          if (renderedHeight === renderedHeightBefore) return
        }
      })()
    }

    let selectNextScrollable = false
    this.scrollableElements = []
    this.elements.forEach((element, i) => {
      if (element.type === 'table') {
        const isScrollable = element.table.canScrollDown || element.table.canScrollUp
        if (isScrollable) {
          this.scrollableElements.push(i)
          if (selectNextScrollable) {
            this.selected = i
            selectNextScrollable = false
          }
        } else if (i === this.selected) {
          this.selected = null
          selectNextScrollable = true
        }
      }
    })

    if (this.selected === null && this.scrollableElements.length) {
      this.selected = this.scrollableElements[this.scrollableElements.length - 1]
    }

    return (
      prefix +
      this.elements
        .reduce((rows, element, i) => {
          let row

          if (element.type === 'table') {
            const { table } = element
            row = table.render({ screen, isSelected: i === this.selected })
          } else if (element.type === 'border') {
            row = `  ${'-'.repeat(screen.width - 4)}  `
          }
          return rows.concat(row)
        }, [])
        .filter((r) => !!r)
        .join('\n')
    )
  }
}

let resizeHandler

module.exports = async function seed(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, verbose, ask, noTty } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const link = cmd.args.link
  if (!link || plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  }
  const { name } = cmd.flags
  const id = Bare.pid
  const { width } = stdio.size()
  const appendMode = noTty === true || !isTTY || !width

  const stats = new DictTable([
    {
      key: 'link',
      label: 'Pear Seed:',
      initial: 'loading...',
      transform: (v) => `${ansi.pear} ${v}`
    },
    { key: 'driveKey', label: 'Drive Key:', initial: 'loading...' },
    { key: 'discoveryKey', label: 'Discovery Key:', initial: 'loading...' },
    { key: 'contentKey', label: 'Content Key:', initial: 'loading...' },
    { key: 'firewalled', label: 'Firewalled:', initial: 'loading...' },
    { key: 'natType', label: 'NAT Type:', initial: 'loading...' },
    { key: 'network', label: 'Network:', initial: 'loading...' }
  ])
  const peers = new Table()
  const layout = new TableLayout(
    [
      { type: 'border' },
      { type: 'table', table: stats },
      { type: 'border' },
      { type: 'table', table: peers }
    ],
    { appendMode }
  )

  stdio.in?.setMode?.(tty.constants.MODE_RAW)
  stdio.in?.on('data', (key) => {
    if (key.toString() === '\u0003') {
      stdio.out.write(`\x1b[?25h`)
      setTimeout(() => {
        process.exit(0)
      }, 1)
    }

    if (!appendMode) {
      const selectedTable = layout.selectedTable
      if (selectedTable) {
        if (key.toString() === '\u001b[A') {
          selectedTable.up()
        } else if (key.toString() === '\u001b[B') {
          selectedTable.down()
        } else if (key.toString() === '\u0009') {
          layout.selectNextScrollable()
        }
      }

      layout.print(stdio)
    }
  })

  stats.set('link', link)

  if (!appendMode) {
    stdio.out.off('resize', resizeHandler)
    resizeHandler = () => {
      layout.print(stdio, { clearScrollback: true })
    }
    stdio.out.on('resize', resizeHandler)
  }

  layout.print(stdio, { clearScrollback: true })

  const output = outputter('seed', {
    announced: () => {
      const msg = '^_^ announced'
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-add': (info) => {
      const msg = `o-o peer join ${info}`
      peers.append([msg])
      layout.print(stdio)
    },
    'peer-remove': (info) => {
      const msg = `-_- peer drop ${info}`
      peers.append([msg])
      layout.print(stdio)
    },
    stats({
      peers = 'unknown',
      driveKey = '',
      discoveryKey = '',
      contentKey = '',
      firewalled = 'unknown',
      natType = 'unknown',
      upload,
      download
    }) {
      const p = `[ Peers: ${peers} ]`
      const ul = `[ ${ansi.up} ${byteSize(upload.totalBytes)} - ${byteSize(upload.speed)}/s ]`
      const dl = `[ ${ansi.down} ${byteSize(download.totalBytes)} - ${byteSize(download.speed)}/s ]`
      const network = `${p} ${ul} ${dl}`

      stats.update({
        driveKey,
        discoveryKey,
        contentKey,
        firewalled,
        natType,
        network
      })

      layout.print(stdio)
    },
    error: (err, info, ipc) => {
      if (err.info && err.info.encrypted && info.ask && isTTY) {
        return permit(ipc, err.info, 'seed')
      } else {
        return `Seed Error (code: ${err.code || 'none'}) ${err.stack}`
      }
    }
  })

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
