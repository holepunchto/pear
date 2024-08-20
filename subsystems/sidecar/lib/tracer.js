'use strict'
const { Readable } = require('streamx')

function deflate (set) {
  const array = [...set]
  array.sort((a, b) => a - b)
  return array.map((n, i) => {
    if (i === 0) return n
    return n - array[i - 1]
  }).filter((n, i) => {
    return i === 0 || n > 0
  })
}

function inflate (array) {
  const { ranges } = array.reduce(({ ranges, sum }, n, i) => {
    if (i === 0) {
      ranges.push({ start: n, end: n + 1 })
      return { ranges, sum: n }
    }

    sum += n

    if (n === 1) ranges[ranges.length - 1].end += 1
    else ranges.push({ start: sum, end: sum + 1 })

    return { ranges, sum }
  }, { ranges: [], sum: 0 })

  return ranges
}

module.exports = class Tracer extends Readable {
  static META = 0
  static DATA = 1

  static inflate (meta, data) { return { meta: inflate(meta), data: inflate(data) } }

  constructor () {
    super()
    this.meta = new Set()
    this.data = new Set()
  }

  deflate () { return { meta: deflate(this.meta), data: deflate(this.data) } }

  instrument () {
    return (seq) => this.capture(seq, this.constructor.META)
  }

  capture (seq, core = this.constructor.DATA) {
    if (Array.isArray(seq)) {
      const [blockLength, blockOffset] = seq
      for (let i = 0; i < blockLength; i++) this.capture(i + blockOffset)
    } else {
      const size = this.meta.size + this.data.size
      if (core === this.constructor.META) this.meta.add(seq)
      if (core === this.constructor.DATA) this.data.add(seq)
      const blocks = this.meta.size + this.data.size
      if (size < blocks) this.push({ seq, core, blocks })
    }
  }
}
