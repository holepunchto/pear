const db = require('mime-db')
module.exports = class Mime {
  constructor () {
    this.extmap = {}
    for (const [ name, type ] of Object.entries(db)) {
      if (!type.extensions || !type.extensions.length) continue
      for (const extension of type.extensions) {
        this.extmap['.' + extension] = name
      }
    }
  }
  type (filepath) {
    const contentType = this.extmap[path.extname(filepath) || '.js']
    if (!contentType) return 'application/octet-stream'
    return contentType.replace('application/node', 'application/javascript')
  }
}
