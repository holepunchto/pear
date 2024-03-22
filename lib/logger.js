'use strict'
const parse = require('./parse')

module.exports = class Logger {
  constructor (args) {
    const { verbose } = parse.args(args, { boolean: ['verbose'] })
    this.verbose = verbose
  }

  info (message) {
    if (!this.verbose) return
    console.log(message)
  }

  error (message) {
    console.error(message)
  }
}
