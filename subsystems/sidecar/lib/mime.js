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
    let contentType = this.extmap.get(split.pop() || 'js')
    if (!contentType) return 'application/octet-stream'
    contentType = contentType.replace('application/node', 'application/javascript')
    if (contentType === 'application/javascript' || contentType === 'text/html' || contentType === 'application/json') {
      contentType += '; charset=utf-8'
    }
    return contentType
  }
}
