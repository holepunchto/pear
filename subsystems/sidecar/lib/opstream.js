'use strict'
const streamx = require('streamx')
const Session = require('./session')
module.exports = class Opstream extends streamx.Readable {
  constructor (op, params, client, sidecar = null) {
    super({
      read (cb) {
        let success = true
        const error = (err) => {
          const { stack, code, message, info } = err
          success = false
          this.push({ tag: 'error', data: { stack, code, message, success, info } })
        }
        const close = () => {
          this.push({ tag: 'final', data: { success } })
          this.push(null)
          cb(null)
          return this.session.close()
        }
        op(params).catch(error).finally(close)
      }
    })
    this.client = client
    this.sidecar = sidecar
    this.session = new Session(client)
  }
}
