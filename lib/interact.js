'use strict'
const { once } = require('bare-events')
module.exports = class Interact {
  constructor (header, params, overrides) {
    this._params = params
    this._overrides = overrides
    stdio.out.write(header)
  }

  async run (opts = {}) {
    const fields = {}
    if (opts.autosubmit) return this.#autosubmit()
    while (this._params.length) {
      const param = this._params.shift()
      while (true) {
        let answer = await this.#input(`${param.prompt}${param.delim || ':'}${param.default && ' (' + param.default + ')'} `)
        if (answer.length === 0) answer = param.default
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
    const overrides = this._overrides
    while (this._params.length) {
      const param = this._params.shift()
      if (overrides.name) fields[overrides.name] = overrides.value
      else fields[param.name] = param.default
    }
    return fields
  }

  async #input (prompt) {
    stdio.out.write(prompt)
    const answer = (await once(stdio.in, 'data')).toString()
    return answer.trim() // remove return char
  }

}

