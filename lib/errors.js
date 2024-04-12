module.exports = class PearError extends Error {
  constructor (msg, code, fn = PearError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'PearError'
  }

  static NO_PATH_PROVIDED (msg) {
    return new PearError(msg, 'ERR_NO_PATH_PROVIDED', PearError.NO_PATH_PROVIDED)
  }

  static BAD_APPLICATION_TYPE (msg) {
    return new PearError(msg, 'ERR_BAD_APPLICATION_TYPE', PearError.BAD_APPLICATION_TYPE)
  }

  static CANNOT_GET_MEDIA_SOURCE_ID (msg) {
    return new PearError(msg, 'ERR_CANNOT_GET_MEDIA_SOURCE_ID', PearError.CANNOT_GET_MEDIA_SOURCE_ID)
  }

  static COULD_NOT_FIND_PARENT (msg) {
    return new PearError(msg, 'ERR_COULD_NOT_FIND_PARENT', PearError.COULD_NOT_FIND_PARENT)
  }

  static CANNOT_SEND (msg) {
    return new PearError(msg, 'ERR_CANNOT_SEND', PearError.CANNOT_SEND)
  }
}
