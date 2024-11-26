'use strict'
const { pipelinePromise, Readable } = require('streamx')
const { pathToFileURL } = require('url-file-url')
const path = require('bare-path')
const Localdrive = require('localdrive')
const Interact = require('../lib/interact')
const transform = require('pear-api/transform')
const parseLink = require('pear-api/parse-link')
const { ERR_PERMISSION_REQUIRED, ERR_OPERATION_FAILED, ERR_DIR_NONEMPTY, ERR_INVALID_TEMPLATE } = require('pear-api/errors')
async function init (link, dir, { ipc, header, autosubmit, defaults, force = false } = {}) {
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = link[0] === '.' || link[0] === '/' || link[1] === ':' || link.startsWith('\\')
  const isType = !isPear && !isFile && !isPath

  if (isType) {
    const { platform } = await ipc.versions()
    if (platform.key.startsWith('/')) link = path.join(__dirname, 'templates', link)
    else link = 'pear://' + platform.key + '/init/templates/' + link
  }
  let params = null
  if (isPear) {
    if (await ipc.trusted(link) === false) {
      const { drive } = parseLink(link)
      throw new ERR_PERMISSION_REQUIRED('Permission required to use template', { key: drive.key })
    }
  }

  if (isPath) {
    let url = pathToFileURL(dir).toString()
    if (url.slice(1) !== '/') url += '/'
    link = new URL(link, url).toString()
  }

  for await (const { tag, data } of ipc.dump({ link: link + '/_template.json', dir: '-' })) {
    if (tag === 'error' && data.code === 'ERR_PERMISSION_REQUIRED') {
      throw new ERR_PERMISSION_REQUIRED(data.message, data.info)
    }
    if (tag !== 'file') continue
    try {
      const definition = JSON.parse(data.value)
      params = definition.params
      for (const prompt of params) {
        if (typeof prompt.validation !== 'string') continue
        prompt.validation = new Function('value', 'return (' + prompt.validation + ')(value)') // eslint-disable-line
      }
    } catch {
      params = null
    }
    break
  }
  if (params === null) throw new ERR_INVALID_TEMPLATE('Invalid Template')
  const dst = new Localdrive(dir)
  if (force === false) {
    let empty = true
    for await (const entry of dst.list()) {
      if (entry) {
        empty = false
        break
      }
    }
    if (empty === false) throw new ERR_DIR_NONEMPTY('Dir is not empty. To overwrite: --force')
  }
  const output = new Readable({ objectMode: true })
  const prompt = new Interact(header, params, { defaults })
  const locals = await prompt.run({ autosubmit })
  output.push({ tag: 'writing' })
  const promises = []
  for await (const { tag, data } of ipc.dump({ link, dir: '-' })) {
    if (tag === 'error') {
      throw new ERR_OPERATION_FAILED('Dump Failed: ' + data.stack)
    }
    if (tag !== 'file') continue
    const { key, value = null } = data
    if (key === '/_template.json') continue
    if (value === null) continue // dir
    const file = transform.sync(key, locals)
    const writeStream = dst.createWriteStream(file)
    const promise = pipelinePromise(transform.stream(value, locals), writeStream)
    promise.catch((err) => { output.push({ tag: 'error', data: err }) })
    promise.then(() => { output.push({ tag: 'wrote', data: { path: file } }) })
    promises.push(promise)
  }

  Promise.allSettled(promises).then((results) => {
    const success = results.every(({ status }) => status === 'fulfilled')
    output.push({ tag: 'written' })
    output.push({ tag: 'final', data: { success } })
    output.push(null)
  })
  return output
}

module.exports = init
