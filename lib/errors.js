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

  static ERR_PEAR_GUI_ERROR (msg) {
    return new PearError(msg, 'ERR_PEAR_GUI_ERROR', PearError.ERR_PEAR_GUI_ERROR)
  }

  static ERR_VIEW_APP_ERROR (msg) {
    return new PearError(msg, 'ERR_VIEW_APP_ERROR', PearError.ERR_VIEW_APP_ERROR)
  }

  static ERR_NO_LINK_SPECIFIED (msg) {
    return new PearError(msg, 'ERR_NO_LINK_SPECIFIED', PearError.ERR_NO_LINK_SPECIFIED)
  }

  static ERR_INVALID_FLAG (msg) {
    return new PearError(msg, 'ERR_INVALID_FLAG', PearError.ERR_INVALID_FLAG)
  }

  static ERR_APPLING_DOES_NOT_EXIST (msg) {
    return new PearError(msg, 'ERR_APPLING_DOES_NOT_EXIST', PearError.ERR_APPLING_DOES_NOT_EXIST)
  }

  static ERR_PERMISSION_REQUIRED (msg) {
    return new PearError(msg, 'ERR_PERMISSION_REQUIRED', PearError.ERR_PERMISSION_REQUIRED)
  }

  static ERR_PLATFORM_ERROR (msg) {
    return new PearError(msg, 'ERR_PLATFORM_ERROR', PearError.ERR_PLATFORM_ERROR)
  }

  static ERR_TRACER_FAILED (msg) {
    return new PearError(msg, 'ERR_TRACER_FAILED', PearError.ERR_TRACER_FAILED)
  }

  static ERR_SHIFT_STORAGE (msg) {
    return new PearError(msg, 'ERR_SHIFT_STORAGE', PearError.ERR_SHIFT_STORAGE)
  }

  static ERR_HTTP_GONE () {
    const err = new PearError('Gone', 'ERR_HTTP_GONE', PearError.ERR_HTTP_GONE)
    err.status = 410
    return err
  }

  static ERR_HTTP_BAD_REQUEST (msg = 'Bad Request') {
    const err = new PearError(msg, 'ERR_HTTP_BAD_REQUEST', PearError.ERR_HTTP_BAD_REQUEST)
    err.status = 400
    return err
  }

  static ERR_HTTP_NOT_FOUND (msg) {
    const err = new PearError(msg, 'ERR_HTTP_NOT_FOUND', PearError.ERR_HTTP_NOT_FOUND)
    err.status = 404
    return err
  }

  static ERR_COULD_NOT_INFER_MODULE_PATH (msg) {
    return new PearError(msg, 'ERR_COULD_NOT_INFER_MODULE_PATH', PearError.ERR_COULD_NOT_INFER_MODULE_PATH)
  }

  static ERR_INVALID_APP_NAME (msg) {
    return new PearError(msg, 'ERR_INVALID_APP_NAME', PearError.ERR_INVALID_APP_NAME)
  }

  static ERR_PACKAGE_JSON_NOT_FOUND (msg) {
    return new PearError(msg, 'ERR_PACKAGE_JSON_NOT_FOUND', PearError.ERR_PACKAGE_JSON_NOT_FOUND)
  }

  static ERR_UNABLE_TO_FETCH_MANIFEST (msg) {
    return new PearError(msg, 'ERR_CONNECTION', PearError.ERR_UNABLE_TO_FETCH_MANIFEST)
  }
}
