'use strict'
const path = require('path')
const transform = require('./lib/transform')
const Localdrive = require('localdrive')
const Interact = require('../lib/interact')

async function init (link, dir, { ipc, header, autosubmit, defaults } = {})  {
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath = link[0] === '.' || link[0] === '/' || link[1] === ':' || link.startsWith('\\')
  const isType = !isPear && !isFile && !isPath
  if (isType) {
    const { platform } = await ipc.versions()
    if (platform.key === null) link = path.join(__dirname, 'templates')
    else link = 'pear://' + (platform.key || 'dev') + '/init/templates/' + link
  }

  let params = null
  for await (const { tag, data } of ipc.dump({ link: link + '/_prompts.js', dir: '-' })) {
    if (tag !== 'file') continue
    params = data.value
    break
  }

  if (params === null) throw new Error('invalid template')
  
  const dst = new Localdrive(dir)

  // TODO read package.json from dst if it's there, 
  // create defaults from the package.json pear field + defaults option

  const prompt = new Interact(header, params, defaults)
  const locals = await prompt.run({ autosubmit })


  for await (const { tag, data } of ipc.dump({ link, dir: '-' })) {
    if (tag !== 'file') continue
    const { key, value = null } = data
    if (key === '_prompts.js') continue
    if (value === null) continue // dir
    await dst.put(key, await transform(value, locals))
  }
}

module.exports = init