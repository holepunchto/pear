'use strict'
const { Readable } = require('streamx')

module.exports = function transform (template, locals) {
  const args = []
  const strings = []
  template += ''
  let last = 0
  for (const result of template.matchAll(/__([a-zA-Z/\\.:]*?)__/g)) {
    const [match, def] = result
    const { index } = result
    const [key, ...meta] = def.split(':').map((s) => s.trim())
    const local = typeof locals[key] === 'function' ? locals[key](key, meta) : locals[key]
    args.push(local)
    strings.push(template.slice(last, index))
    last = index + match.length
  }
  strings.push(template.slice(last))
  return new Readable({
    objectMode: true,
    async read (cb) {
      try {
        for (let i = 0; i < strings.length; i++) {
          this.push(strings[i])
          if (i < args.length) for await (const chunk of interlope(await args[i])) this.push(chunk)
        }
        this.push(null)
        cb(null)
      } catch (err) {
        this.destroy(err)
        cb(err)
      }
    }
  })
}

function interlope (arg) {
  return new Readable({
    objectMode: true,
    async read (cb) {
      try {
        if (arg === null || typeof arg !== 'object') {
          this.push(arg)
        } else if (Array.isArray(arg)) {
          for (const item of arg) {
            if (item === arg) continue
            for await (const chunk of interlope(item)) this.push(chunk)
          }
        } else if (typeof arg[Symbol.asyncIterator] === 'function') {
          for await (const chunk of arg) this.push(chunk)
        } else {
          this.push(await arg)
        }
        this.push(null)
        cb(null)
      } catch (err) {
        this.destroy(err)
        cb(err)
      }
    }
  })
}