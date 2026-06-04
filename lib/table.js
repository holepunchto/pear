const { EventEmitter } = require('bare-events')
const { ansi } = require('../lib/terminal.js')

class Table extends EventEmitter {
  constructor(rows = [], opts = {}) {
    const { view, offset = 0, minPadding = 1, maxPadding = 3 } = opts
    super()
    this._rows = rows
    this.view = view
    this.offset = offset
    this.minPadding = minPadding
    this.maxPadding = maxPadding
  }
  swap(i, row) {
    this._rows[i] = row
    this.emit('row', row)
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
    this.emit('row', row)
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
    const changed = this.state[key] !== val
    this.state[key] = val

    if (changed) {
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
    if (this.selected === null) return null
    const selectedElement = this.elements[this.selected]
    if (selectedElement.type !== 'table') return null
    return selectedElement.table
  }
  selectNextScrollable() {
    if (this.scrollableElements.length === 0) return
    if (this.selected === null) {
      this.selected = this.scrollableElements[this.scrollableElements.length - 1]
    } else {
      const i = this.scrollableElements.indexOf(this.selected)
      this.selected = this.scrollableElements[(i + 1) % this.scrollableElements.length]
    }
  }
  print(stdio, opts) {
    const str = this.render({ ...opts, screen: stdio.size() })
    if (str) stdio.out.write(this.appendMode ? `${str}\n` : str)
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
            row = ansi.gray(`  ${'-'.repeat(Math.max(0, screen.width - 4))}  `)
          }
          return rows.concat(row)
        }, [])
        .filter((r) => !!r)
        .join('\n')
    )
  }
}

module.exports = { Table, DictTable, TableLayout }
