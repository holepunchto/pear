class PearError extends Error {
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
}

function ERR_NO_LINK_SPECIFIED (msg) {
  return new PearError(msg, 'ERR_NO_LINK_SPECIFIED', ERR_NO_LINK_SPECIFIED)
}

function ERR_INVALID_FLAG (msg) {
  return new PearError(msg, 'ERR_INVALID_FLAG', ERR_INVALID_FLAG)
}

function ERR_APPLING_DOES_NOT_EXIST (msg) {
  return new PearError(msg, 'ERR_APPLING_DOES_NOT_EXIST', ERR_APPLING_DOES_NOT_EXIST)
}

function ERR_PERMISSION_REQUIRED (msg) {
  return new PearError(msg, 'ERR_PERMISSION_REQUIRED', ERR_PERMISSION_REQUIRED)
}

function ERR_PLATFORM_ERROR (msg) {
  return new PearError(msg, 'ERR_PLATFORM_ERROR', ERR_PLATFORM_ERROR)
}

function ERR_TRACER_FAILED (msg) {
  return new PearError(msg, 'ERR_TRACER_FAILED', ERR_TRACER_FAILED)
}

function ERR_SHIFT_STORAGE_ERROR (msg) {
  return new PearError(msg, 'ERR_SHIFT_STORAGE_ERROR', ERR_SHIFT_STORAGE_ERROR)
}

function ERR_HTTP_GONE () {
  const err = new PearError('Gone', 'ERR_HTTP_GONE', ERR_HTTP_GONE)
  err.status = 410
  return err
}

function ERR_HTTP_BAD_REQUEST (msg = 'Bad Request') {
  const err = new PearError(msg, 'ERR_HTTP_BAD_REQUEST', ERR_HTTP_BAD_REQUEST)
  err.status = 400
  return err
}

function ERR_HTTP_NOT_FOUND (msg) {
  const err = new PearError(msg, 'ERR_HTTP_NOT_FOUND', ERR_HTTP_NOT_FOUND)
  err.status = 404
  return err
}

function ERR_COULD_NOT_INFER_MODULE_PATH (msg) {
  return new PearError(msg, 'ERR_COULD_NOT_INFER_MODULE_PATH', ERR_COULD_NOT_INFER_MODULE_PATH)
}

function ERR_INVALID_APP_NAME (msg) {
  return new PearError(msg, 'ERR_INVALID_APP_NAME', ERR_INVALID_APP_NAME)
}

function ERR_INVALID_APPLICATION_STORAGE (msg) {
  return new PearError(msg, 'ERR_INVALID_APPLICATION_STORAGE', ERR_INVALID_APPLICATION_STORAGE)
}

function ERR_PACKAGE_JSON_NOT_FOUND (msg) {
  return new PearError(msg, 'ERR_PACKAGE_JSON_NOT_FOUND', ERR_PACKAGE_JSON_NOT_FOUND)
}

function ERR_UNABLE_TO_FETCH_MANIFEST (msg) {
  return new PearError(msg, 'ERR_CONNECTION', ERR_UNABLE_TO_FETCH_MANIFEST)
}

function ERR_INVALID_PACKAGE_JSON (msg) {
  return new PearError(msg, 'ERR_INVALID_PACKAGE_JSON', ERR_INVALID_PACKAGE_JSON)
}

function ERR_UNKNOWN_GC_RESOURCE (msg) {
  return new PearError(msg, 'ERR_UNKNOWN_GC_RESOURCE', ERR_UNKNOWN_GC_RESOURCE)
}

function ERR_ASSERTION (msg) {
  return new PearError(msg, 'ERR_ASSERTION', ERR_ASSERTION)
}

module.exports = {
  ERR_NO_LINK_SPECIFIED,
  ERR_INVALID_FLAG,
  ERR_APPLING_DOES_NOT_EXIST,
  ERR_PERMISSION_REQUIRED,
  ERR_PLATFORM_ERROR,
  ERR_TRACER_FAILED,
  ERR_SHIFT_STORAGE_ERROR,
  ERR_HTTP_GONE,
  ERR_HTTP_BAD_REQUEST,
  ERR_HTTP_NOT_FOUND,
  ERR_COULD_NOT_INFER_MODULE_PATH,
  ERR_INVALID_APP_NAME,
  ERR_INVALID_APPLICATION_STORAGE,
  ERR_PACKAGE_JSON_NOT_FOUND,
  ERR_UNABLE_TO_FETCH_MANIFEST,
  ERR_INVALID_PACKAGE_JSON,
  ERR_UNKNOWN_GC_RESOURCE,
  ERR_ASSERTION
}