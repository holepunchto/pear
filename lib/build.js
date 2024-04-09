'use strict'
const init = require('bare-dev/init')
const configure = require('bare-dev/configure')
const build = require('bare-dev/build')
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')

class RequirementError extends Error {
  constructor (message) {
    super(message)
    this.name = 'RequirementError'
  }
}

module.exports = async function ({ key, dir, stream, verbose = true }) {
  try {
    stream.push({ tag: 'initializing' })
    if (checkFile(path.resolve(dir, 'CMakeLists.txt'))) {
      stream.push({ tag: 'cmakeExists' })
    } else {
      stream.push({ tag: 'cmakeCreated' })
      await init.appling({ cwd: dir, key, verbose, quiet: false, ...loadApplingOpts(dir) })
    }

    await stream.push({ tag: 'configuring' })
    await configure({ source: dir, cwd: dir, verbose, quiet: false })

    stream.push({ tag: 'building' })
    await build({ cwd: dir, verbose, quiet: false })

    stream.push({ tag: 'done', data: { key, dir } })
  } catch (err) {
    stream.push({ tag: 'error', data: { ...err, stack: err.stack, message: err.message, code: err.code } })
  }
}

function checkFile (file) {
  try {
    fs.accessSync(file)
    return true
  } catch {
    return false
  }
}

function loadJsonFile (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`Failed to load ${file}: ${e.message}`)
  }
}

function checkApplingOpts (pkg) {
  if (!pkg.pear) throw new Error('No pear field found in package.json')

  const missingFields = []

  const requiredBaseFields = ['name']
  for (const baseField of requiredBaseFields) {
    if (!pkg[baseField] && !pkg?.pear?.[baseField] && !pkg?.pear?.build?.[baseField]) missingFields.push(baseField)
  }

  const requiredFieldsByPlatform = {
    linux: ['build.linux.category'],
    darwin: ['build.macos.identifier', 'build.macos.category', 'build.macos.entitlements', 'build.macos.signingIdentity', 'build.macos.signingSubject'],
    win32: ['build.windows.signingSubject', 'build.windows.signingThumbprint']
  }

  missingFields.push(...requiredFieldsByPlatform[os.platform()].filter(field => {
    const fieldPath = field.split('.')

    let value = pkg.pear
    for (const key of fieldPath) {
      if (value[key] === undefined) return true
      value = value[key]
    }

    return false
  }))

  if (missingFields.length > 0) {
    throw new RequirementError(`Missing required pear fields in package.json: ${missingFields.join(', ')}`)
  }
}

function loadApplingOpts (dir) {
  const pkgPath = path.resolve(dir, 'package.json')
  if (!checkFile(pkgPath)) throw new RequirementError('No package.json found')

  const pkg = loadJsonFile(pkgPath)
  checkApplingOpts(pkg)

  const { pear } = pkg

  return {
    name: pear?.name || pkg.name,
    version: pkg.version,
    author: pear?.author || pkg.author,
    description: pear?.description || pkg.description,
    linux: pear?.build?.linux || {},
    macos: {
      identifier: pear?.build?.macos?.identifier,
      category: pear?.build?.macos?.category,
      entitlements: pear?.build?.macos?.entitlements || ['undefined'],
      signing: {
        identity: pear?.build?.macos?.signingIdentity, subject: pear?.build?.macos?.signingSubject
      }
    },
    windows: {
      signing: {
        subject: pear?.build?.windows?.signingSubject, thumbprint: pear?.build?.windows?.signingThumbprint
      }
    }
  }
}
