const db = require('mime-db')

module.exports = class Mime {
  constructor () {
    this.extmap = new Map()
    for (const [name, type] of Object.entries(db)) {
      if (!type.extensions || !type.extensions.length) continue
      for (const extension of type.extensions) {
        this.extmap.set(extension, name)
      }
    }
  }

  type (filepath) {
    const split = filepath.split('.')
    const extension = split.pop() || 'js'
    let contentType = this.extmap.get(extension)
    if (extension === 'jsx') contentType = 'application/javascript'
    if (!contentType) return 'application/octet-stream'
    contentType = contentType.replace('application/node', 'application/javascript').replace('text/javascript', 'application/javascript')
    if (contentType === 'application/javascript' || contentType === 'text/html' || contentType === 'application/json') {
      contentType += '; charset=utf-8'
    }
    return contentType
  }
}
