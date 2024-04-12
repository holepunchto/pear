'use strict'
const init = require('bare-dev/init')
const configureApp = require('bare-dev/configure')
const buildApp = require('bare-dev/build')
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')
const streamx = require('streamx')

async function * build ({ key, dir, pkg }) {
  yield { tag: 'initializing' }
  if (checkFile(path.resolve(dir, 'CMakeLists.txt'))) {
    yield { tag: 'cmakeExists' }
  } else {
    await init.appling({ cwd: dir, key, quiet: false, ...loadApplingOpts(pkg) })
    yield { tag: 'cmakeCreated' }
  }

  const stdio = ['ignore', 'pipe', 'pipe']

  yield { tag: 'configuring' }
  const configureProcess = configureApp({ source: dir, cwd: dir, verbose: false, quiet: false, stdio, detached: true })
  for await (const data of handleOutput(configureProcess)) yield data

  yield { tag: 'building' }
  const buildProcess = buildApp({ cwd: dir, verbose: false, quiet: false, stdio, detached: true })
  for await (const data of handleOutput(buildProcess)) yield data

  yield { tag: 'done', data: { key, dir } }
}

async function * handleOutput (child) {
  const mergedStream = new streamx.Readable()

  child.stdout.on('data', (data) => mergedStream.push({ tag: 'stdout', data: data?.toString() }))
  child.stderr.on('data', (data) => mergedStream.push({ tag: 'stderr', data: data?.toString() }))
  child.on('exit', (code) => mergedStream.push({ tag: 'exit', data: code }))

  for await (const { tag, data } of mergedStream) {
    if (tag === 'exit') {
      if (data !== 0) throw new Error(`Build failed with exit code ${data}`)
      break
    }

    yield { tag, data }
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
    throw Object.assign(
      new Error(`Missing required pear fields in package.json: ${missingFields.join(', ')}`),
      { code: 'ERR_MISSING_REQUIRED_FIELDS' }
    )
  }
}

function loadApplingOpts (pkg) {
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

module.exports = {
  build,
  checkApplingOpts
}
