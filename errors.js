'use strict'
class PearError extends Error {
  static define (code, defmsg, props = null) {
    this[code] = {
      [code]: class extends this {
        constructor (msg = defmsg, info = null) {
          super(msg, code, info)
          if (props !== null) Object.assign(this, props)
        }
      }
    }[code]
  }

  static known (prefix = 'ERR_', ...prefixes) {
    return [...Object.getOwnPropertyNames(this).filter((name) => name.startsWith(prefix)), ...prefixes.flatMap((prefix) => this.known(prefix))]
  }

  constructor (msg, code, info = null) {
    super(msg)
    this.code = code
    if (info !== null) this.info = info
  }
}

PearError.define('ERR_INVALID_INPUT')

PearError.define('ERR_INVALID_LINK')

PearError.define('ERR_INVALID_APPLING')

PearError.define('ERR_INVALID_APP_NAME')

PearError.define('ERR_INVALID_APP_STORAGE')

PearError.define('ERR_INVALID_PROJECT_DIR')

PearError.define('ERR_INVALID_GC_RESOURCE')

PearError.define('ERR_INVALID_CONFIG')

PearError.define('ERR_INVALID_TEMPLATE')

PearError.define('ERR_PERMISSION_REQUIRED')

PearError.define('ERR_HTTP_GONE', 'Gone', { status: 410 })

PearError.define('ERR_HTTP_BAD_REQUEST', 'Bad Request', { status: 400 })

PearError.define('ERR_HTTP_NOT_FOUND', 'Not Found', { status: 404 })

PearError.define('ERR_SECRET_NOT_FOUND')

PearError.define('ERR_NOT_FOUND_OR_NOT_CONNECTED')

PearError.define('ERR_COULD_NOT_INFER_MODULE_PATH')

PearError.define('ERR_INVALID_MANIFEST')

PearError.define('ERR_INTERNAL_ERROR')

PearError.define('ERR_UNSTAGED')

PearError.define('ERR_DIR_NONEMPTY')

PearError.define('ERR_OPERATION_FAILED')

PearError.define('ERR_TRACER_FAILED')

PearError.define('ERR_ASSERTION')

PearError.define('ERR_UNKNOWN')

module.exports = PearError
