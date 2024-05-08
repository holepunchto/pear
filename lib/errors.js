'use strict'
class PearError extends Error {
  static ERR_INVALID_INPUT = ERR_INVALID_INPUT
  static ERR_INVALID_LINK = ERR_INVALID_LINK
  static ERR_INVALID_FLAG = ERR_INVALID_FLAG
  static ERR_INVALID_APPLING = ERR_INVALID_APPLING
  static ERR_INVALID_APP_NAME = ERR_INVALID_APP_NAME
  static ERR_INVALID_APP_STORAGE = ERR_INVALID_APP_STORAGE
  static ERR_INVALID_PROJECT_DIR = ERR_INVALID_PROJECT_DIR
  static ERR_INVALID_GC_RESOURCE = ERR_INVALID_GC_RESOURCE
  static ERR_PERMISSION_REQUIRED = ERR_PERMISSION_REQUIRED
  static ERR_PLATFORM_ERROR = ERR_PLATFORM_ERROR
  static ERR_TRACER_FAILED = ERR_TRACER_FAILED
  static ERR_HTTP_GONE = ERR_HTTP_GONE
  static ERR_HTTP_BAD_REQUEST = ERR_HTTP_BAD_REQUEST
  static ERR_HTTP_NOT_FOUND = ERR_HTTP_NOT_FOUND
  static ERR_COULD_NOT_INFER_MODULE_PATH = ERR_COULD_NOT_INFER_MODULE_PATH
  static ERR_UNABLE_TO_FETCH_MANIFEST = ERR_UNABLE_TO_FETCH_MANIFEST
  static ERR_ASSERTION = ERR_ASSERTION
  static ERR_UNKNOWN = ERR_UNKNOWN
  static known = known
  constructor (msg, code, fn = PearError) {
    super(msg)
    this.code = code
    if (Error.captureStackTrace) Error.captureStackTrace(this, fn)
  }
}

function known (prefix = 'ERR_') {
  return Object.getOwnPropertyNames(PearError).filter((name) => name.startsWith(prefix))
}

function ERR_INVALID_INPUT (msg) {
  return new PearError(msg, 'ERR_INVALID_INPUT', ERR_INVALID_INPUT)
}

function ERR_INVALID_LINK (msg) {
  return new PearError(msg, 'ERR_INVALID_LINK', ERR_INVALID_LINK)
}

function ERR_INVALID_FLAG (msg) {
  return new PearError(msg, 'ERR_INVALID_FLAG', ERR_INVALID_FLAG)
}

function ERR_INVALID_APPLING (msg) {
  return new PearError(msg, 'ERR_INVALID_APPLING', ERR_INVALID_APPLING)
}

function ERR_INVALID_APP_NAME (msg) {
  return new PearError(msg, 'ERR_INVALID_APP_NAME', ERR_INVALID_APP_NAME)
}

function ERR_INVALID_APP_STORAGE (msg) {
  return new PearError(msg, 'ERR_INVALID_APP_STORAGE', ERR_INVALID_APP_STORAGE)
}

function ERR_INVALID_PROJECT_DIR (msg) {
  return new PearError(msg, 'ERR_INVALID_PROJECT_DIR', ERR_INVALID_PROJECT_DIR)
}

function ERR_INVALID_GC_RESOURCE (msg) {
  return new PearError(msg, 'ERR_INVALID_GC_RESOURCE', ERR_INVALID_GC_RESOURCE)
}

function ERR_PERMISSION_REQUIRED (msg) {
  return new PearError(msg, 'ERR_PERMISSION_REQUIRED', ERR_PERMISSION_REQUIRED)
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

function ERR_UNABLE_TO_FETCH_MANIFEST (msg) {
  return new PearError(msg, 'ERR_CONNECTION', ERR_UNABLE_TO_FETCH_MANIFEST)
}

function ERR_PLATFORM_ERROR (msg) {
  return new PearError(msg, 'ERR_PLATFORM_ERROR', ERR_PLATFORM_ERROR)
}

function ERR_TRACER_FAILED (msg) {
  return new PearError(msg, 'ERR_TRACER_FAILED', ERR_TRACER_FAILED)
}

function ERR_PLATFORM_ERROR (msg) {
  return new PearError(msg, 'ERR_PLATFORM_ERROR', ERR_PLATFORM_ERROR)
}

function ERR_ASSERTION (msg) {
  return new PearError(msg, 'ERR_ASSERTION', ERR_ASSERTION)
}

function ERR_UNKNOWN (msg) {
  return new PearError(msg, 'ERR_UNKNOWN', ERR_UNKNOWN)
}

module.exports = PearError
