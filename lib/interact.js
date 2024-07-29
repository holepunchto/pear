'use strict'
const stdio = require('./stdio')
const { once } = require('bare-events')
const rx = /[\x1B\x9B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\x07)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g // eslint-disable-line no-control-regex
module.exports = class Interact {
  constructor (header, params, defaults = {}) {
    this._params = params
    this._defaults = defaults
    stdio.out.write(header)
  }

  async run (opts) {
    try {
      return await this.#run(opts)
    } finally {
      if (stdio.inAttached) stdio.in.destroy()
    }
  }

  async #run (opts = {}) {
    if (opts.autosubmit) return this.#autosubmit()
    const fields = {}
    const defaults = this._defaults
    while (this._params.length) {
      const param = this._params.shift()
      while (true) {
        const deflt = defaults[param.name] ?? param.default
        let answer = await this.#input(`${param.prompt}${param.delim || ':'}${deflt && ' (' + deflt + ')'} `)

        if (answer.length === 0) answer = defaults[param.name] ?? deflt
        if (!param.validation || await param.validation(answer)) {
          if (typeof answer === 'string') answer = answer.replace(rx, '')
          fields[param.name] = answer
          break
        } else {
          stdio.out.write(param.msg + '\n')
        }
      }
    }
    return fields
  }

  #autosubmit () {
    const fields = {}
    const defaults = this._defaults
    while (this._params.length) {
      const param = this._params.shift()
      fields[param.name] = defaults[param.name] ?? param.default
    }
    return fields
  }

  async #input (prompt) {
    stdio.out.write(prompt)
    const answer = (await once(stdio.in, 'data')).toString()
    return answer.trim() // remove return char
  }
}
