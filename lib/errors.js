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

  static XML_HTTP_REQUEST_ERROR (msg) {
    return new PearError(msg, 'ERR_XML_HTTP_REQUEST_ERROR', PearError.XML_HTTP_REQUEST_ERROR)
  }

  static A_VIEW_CANNOT_BE_MINIMIZED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_MINIMIZED', PearError.A_VIEW_CANNOT_BE_MINIMIZED)
  }

  static A_VIEW_CANNOT_BE_MAXIMIZED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_MAXIMIZED', PearError.A_VIEW_CANNOT_BE_MAXIMIZED)
  }

  static A_VIEW_CANNOT_BE_FULLSCREENED (msg) {
    return new PearError(msg, 'ERR_A_VIEW_CANNOT_BE_FULLSCREENED', PearError.A_VIEW_CANNOT_BE_FULLSCREENED)
  }

  static NO_LINK_SPECIFIED (msg) {
    return new PearError(msg, 'ERR_NO_LINK_SPECIFIED', PearError.NO_LINK_SPECIFIED)
  }

  static INVALID_FLAG (msg) {
    return new PearError(msg, 'ERR_INVALID_FLAG', PearError.INVALID_FLAG)
  }

  static APPLING_DOES_NOT_EXIST (msg) {
    return new PearError(msg, 'ERR_APPLING_DOES_NOT_EXIST', PearError.APPLING_DOES_NOT_EXIST)
  }

  static PERMISSION_REQUIRED (msg) {
    return new PearError(msg, 'ERR_PERMISSION_REQUIRED', PearError.PERMISSION_REQUIRED)
  }

  static UNRECOGNIZED_START_ID (msg) {
    return new PearError(msg, 'ERR_UNRECOGNIZED_START_ID', PearError.UNRECOGNIZED_START_ID)
  }

  static SESSION_IS_CLOSED (msg) {
    return new PearError(msg, 'ERR_SESSION_IS_CLOSED', PearError.SESSION_IS_CLOSED)
  }

  static BARE_CORE (msg) {
    return new PearError(msg, 'ERR_BARE_CORE', PearError.BARE_CORE)
  }

  static TRACER_FAILED (msg) {
    return new PearError(msg, 'ERR_TRACER_FAILED', PearError.TRACER_FAILED)
  }

  static MOVE_STORAGE (msg) {
    return new PearError(msg, 'ERR_MOVE_STORAGE', PearError.MOVE_STORAGE)
  }

  static NO_APP_STORAGE (msg) {
    return new PearError(msg, 'ERR_NOENT', PearError.NO_APP_STORAGE)
  }

  static APP_STORAGE_ALREADY_EXISTS (msg) {
    return new PearError(msg, 'ERR_EXISTS', PearError.APP_STORAGE_ALREADY_EXISTS)
  }

  static GONE () {
    const err = new PearError('Gone', 'ERR_GONE', PearError.GONE_REQUIRED)
    err.status = 410
    return err
  }

  static BAD_REQUEST (msg = 'Bad Request') {
    const err = new PearError(msg, 'ERR_BAD_REQUEST', PearError.BAD_REQUEST)
    err.status = 400
    return err
  }

  static NOT_FOUND (msg) {
    const err = new PearError(msg, 'ERR_NOT_FOUND', PearError.NOT_FOUND)
    err.status = 404
    return err
  }

  static COULD_NOT_INFER_MODULE_PATH (msg) {
    return new PearError(msg, 'ERR_COULD_NOT_INFER_MODULE_PATH', PearError.COULD_NOT_INFER_MODULE_PATH)
  }

  static NOT_IMPLEMENTED (msg) {
    return new PearError(msg, 'ERR_NOT_IMPLEMENTED', PearError.NOT_IMPLEMENTED)
  }

  static INPUT_ERROR (msg, { showUsage = true } = {}) {
    const err = new PearError(msg, 'ERR_INPUT', PearError.INPUT_ERROR)
    err.showUsage = showUsage
  }
}
