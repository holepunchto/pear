'use strict'
const { pipelinePromise } = require('streamx')
const path = require('bare-path')
const transform = require('./lib/transform')
const Localdrive = require('localdrive')
const Interact = require('../lib/interact')
const { ERR_OPERATION_FAILED, ERR_DIR_NONEMPTY, ERR_INVALID_TEMPLATE } = require('../errors')
async function init (link, dir, { ipc, header, autosubmit, defaults, force = false } = {}) {
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = link[0] === '.' || link[0] === '/' || link[1] === ':' || link.startsWith('\\')
  const isType = !isPear && !isFile && !isPath
  if (isType) {
    const { platform } = await ipc.versions()
    if (platform.key.startsWith('/')) link = path.join(__dirname, 'templates', link)
    else link = 'pear://' + (platform.key || 'dev') + '/init/templates/' + link
  }

  let params = null

  for await (const { tag, data } of ipc.dump({ link: link + '/_template.json', dir: '-' })) {
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

  const prompt = new Interact(header, params, defaults)
  try {
    const locals = await prompt.run({ autosubmit })
    for await (const { tag, data } of ipc.dump({ link, dir: '-' })) {
      if (tag === 'error') {
        throw new ERR_OPERATION_FAILED('Dump Failed: ' + data.stack)
      }
      if (tag !== 'file') continue
      const { key, value = null } = data
      if (key === '/_template.json') continue
      if (value === null) continue // dir

      const writeStream = dst.createWriteStream(transform.sync(key, locals))
      await pipelinePromise(transform.stream(value, locals), writeStream)
    }
  } finally {
    await dst.close()
  }
}

module.exports = init
