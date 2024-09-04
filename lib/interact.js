'use strict'
const stdio = require('./stdio')
const { once } = require('bare-events')
const readline = require('bare-readline')
const { Writable } = require('streamx')
const tty = require('bare-tty')
const rx = /[\x1B\x9B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\x07)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g // eslint-disable-line no-control-regex
module.exports = class Interact {
  constructor (header, params, opts = {}) {
    this._header = header
    this._params = params
    this._defaults = opts.defaults || {}

    const mask = (data, cb) => {
      if (data.length > 4) { // is full line
        const prompt = this._rl._prompt
        const regex = new RegExp(`(${prompt})([\\x20-\\x7E]+)`, 'g') // match printable chars after prompt
        const masked = data.toString().replace(regex, (_, prompt, pwd) => prompt + '*'.repeat(pwd.length))
        stdio.out.write(masked)
      } else {
        stdio.out.write(data)
      }
      cb(null)
    }

    this._rl = readline.createInterface({
      input: stdio.in,
      output: opts.masked ? new Writable({ write: mask }) : stdio.out
    })

    this._rl.input.setMode(tty.constants.MODE_RAW)
    this._rl.on('close', () => {
      console.log() // new line
      Bare.exit()
    })
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
    stdio.out.write(this._header)
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
    this._rl._prompt = prompt
    const answer = (await once(this._rl, 'data')).toString()
    return answer.trim() // remove return char
  }
}
