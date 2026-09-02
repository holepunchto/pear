'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_MANIFEST } = require('pear-errors')

async function localPkg(dir) {
  await validate(dir)
  let manifest = null
  try {
    manifest = await fs.promises.readFile(path.join(dir, 'package.json'))
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw ERR_INVALID_PROJECT_DIR(`package.json in ${dir} could not be read: ${err.message}`)
    }
  }
  if (manifest === null) return
  let pkg = null
  try {
    pkg = JSON.parse(manifest)
  } catch (err) {
    throw ERR_INVALID_MANIFEST(`package.json in ${dir} is not a valid JSON object`)
  }
  if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw ERR_INVALID_MANIFEST(`package.json in ${dir} is invalid: not a JSON object`)
  }
  return pkg
}

async function validate(dir) {
  let stat = null
  try {
    stat = await fs.promises.stat(dir)
  } catch {
    throw ERR_INVALID_PROJECT_DIR(`${dir} not found`)
  }
  if (stat.isDirectory() === false) throw ERR_INVALID_PROJECT_DIR(`${dir} is not a directory`)
}

module.exports = { validate, localPkg }
