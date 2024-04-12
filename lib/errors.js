module.exports = class PearError extends Error {
  constructor (msg, code, fn = PearError) {
    super(msg)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'PearError'
  }

  static NO_PATH_PROVIDED (msg) {
    return new PearError(msg, 'ERR_NO_PATH_PROVIDED', this.NO_PATH_PROVIDED)
  }

  static BAD_APPLICATION_TYPE (msg) {
    return new PearError(msg, 'ERR_BAD_APPLICATION_TYPE', this.BAD_APPLICATION_TYPE)
  }

  static CANNOT_GET_MEDIA_SOURCE_ID (msg) {
    return new PearError(msg, 'ERR_CANNOT_GET_MEDIA_SOURCE_ID', this.CANNOT_GET_MEDIA_SOURCE_ID)
  }

  static COULD_NOT_FIND_PARENT (msg) {
    return new PearError(msg, 'ERR_COULD_NOT_FIND_PARENT', this.COULD_NOT_FIND_PARENT)
  }

  static CANNOT_SEND (msg) {
    return new PearError(msg, 'ERR_CANNOT_SEND', this.CANNOT_SEND)
  }

  static XML_HTTP_REQUEST_ERROR (msg) {
    return new PearError(msg, 'ERR_XML_HTTP_REQUEST_ERROR', this.XML_HTTP_REQUEST_ERROR)
  }

  static A_VIEW_CANNOT_BE_MINIMIZED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_MINIMIZED', this.A_VIEW_CANNOT_BE_MINIMIZED)
  }

  static A_VIEW_CANNOT_BE_MAXIMIZED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_MAXIMIZED', this.A_VIEW_CANNOT_BE_MAXIMIZED)
  }

  static A_VIEW_CANNOT_BE_FULLSCREENED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_FULLSCREENED', this.A_VIEW_CANNOT_BE_FULLSCREENED)
  }

  static NO_LINK_SPECIFIED (msg) {
    return new PearError(msg, 'ERR_NO_LINK_SPECIFIED', this.NO_LINK_SPECIFIED)
  }

  static INVALID_FLAG (msg) {
    return new PearError(msg, 'ERR_INVALID_FLAG', this.INVALID_FLAG)
  }

  static APPLING_DOES_NOT_EXIST (msg) {
    return new PearError(msg, 'ERR_APPLING_DOES_NOT_EXIST', this.APPLING_DOES_NOT_EXIST)
  }

  static PERMISSION_REQUIRED (msg) {
    return new PearError(msg, 'ERR_PERMISSION_REQUIRED', this.PERMISSION_REQUIRED)
  }
}
