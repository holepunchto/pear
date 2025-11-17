'use strict'
const fsp = require('bare-fs/promises')
const os = require('bare-os')
const { basename, resolve } = require('bare-path')
const { ansi, outputter, permit } = require('pear-terminal')
const { pipelinePromise, Readable } = require('streamx')
const { pathToFileURL } = require('url-file-url')
const Localdrive = require('localdrive')
const { Interact } = require('pear-terminal')
const stamp = require('pear-stamp')
const plink = require('pear-link')

const {
  ERR_PERMISSION_REQUIRED,
  ERR_OPERATION_FAILED,
  ERR_DIR_NONEMPTY,
  ERR_INVALID_TEMPLATE
} = require('pear-errors')

const output = outputter('init', {
  writing: () => '',
  error: ({ code, stack }) => `Init Error (code: ${code || 'none'}) ${stack}`,
  wrote: ({ path }) => `* ${path}`,
  written: () => ''
})

module.exports = (ipc) =>
  async function init(cmd) {
    const cwd = os.cwd()

    const { yes, force, tmpl, ask } = cmd.flags
    const dir = cmd.args.dir ? resolve(cwd, cmd.args.dir) : cwd
    let dirStat = null
    try {
      dirStat = await fsp.stat(dir)
    } catch {}
    const pkgPath = resolve(dir, 'package.json')
    let pkg = null
    const dirExists = dirStat !== null && dirStat.isDirectory()
    if (dirExists) {
      try {
        pkg = JSON.parse(await fsp.readFile(pkgPath))
      } catch {}
    }

    const cfg = pkg?.pear || {}
    const name = cfg?.name || pkg?.name || basename(dir)
    const link = cmd.args.link || tmpl

    const defaults = { name }

    const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
    let header = `\n${banner}${ansi.dim('›')}\n\n`
    if (force) header += ansi.bold('FORCE MODE\n\n')

    try {
      await output(
        false,
        await render(link, dir, {
          cwd,
          ipc,
          autosubmit: yes,
          ask,
          force,
          defaults,
          header,
          tmpl,
          pkg
        })
      )
    } catch (err) {
      if (err.code !== 'ERR_PERMISSION_REQUIRED' || !ask) throw err
      await permit(ipc, err.info, 'init')
    } finally {
      await ipc.close()
    }
  }

async function render(link = 'default', dir, opts = {}) {
  const { cwd, ipc, header, autosubmit, defaults, force = false, pkg } = opts
  let { ask = true } = opts
  const isPear = link.startsWith('pear://')
  const isFile = link.startsWith('file://')
  const isPath =
    link[0] === '.' ||
    link[0] === '/' ||
    link[1] === ':' ||
    link.startsWith('\\')
  const isName = !isPear && !isFile && !isPath

  if (isName) {
    const map = new Map(
      Object.entries({
        ui: 'pear://templates/ui/electron',
        default: 'pear://templates/terminal/default'
      })
    )
    if (map.has(link)) {
      link = map.get(link)
      ask = false
    }
  }

  let params = null
  if (isPear && ask) {
    if ((await ipc.trusted(link)) === false) {
      const { drive } = plink.parse(link)
      throw ERR_PERMISSION_REQUIRED('Permission required to use template', {
        key: drive.key
      })
    }
  }

  if (isPath) {
    let url = pathToFileURL(cwd).toString()
    if (url.slice(1) !== '/') url += '/'
    link = new URL(link, url).toString()
  }

  for await (const { tag, data } of ipc.dump({
    link: link + '/_template.json',
    dir: '-'
  })) {
    if (tag === 'error' && data.code === 'ERR_PERMISSION_REQUIRED') {
      throw ERR_PERMISSION_REQUIRED(data.message, data.info)
    }
    if (tag !== 'file') continue
    try {
      const definition = JSON.parse(data.value)
      params = definition.params
      for (const prompt of params) {
        defaults[prompt.name] = Array.isArray(prompt.override)
          ? prompt.override.reduce((o, k) => o?.[k], pkg)
          : (prompt.default ?? defaults[prompt.name])
        if (typeof prompt.validation !== 'string') continue
        prompt.validation = new Function(
          'value',
          'return (' + prompt.validation + ')(value)'
        ) // eslint-disable-line
      }
    } catch {
      params = null
    }
    break
  }
  if (params === null)
    throw ERR_INVALID_TEMPLATE('Invalid Template or Unreachable Link')
  const dst = new Localdrive(dir)
  if (force === false) {
    let empty = true
    for await (const entry of dst.list()) {
      if (entry) {
        empty = false
        break
      }
    }
    if (empty === false)
      throw ERR_DIR_NONEMPTY('Dir is not empty. To overwrite: --force')
  }
  const output = new Readable({ objectMode: true })
  const prompt = new Interact(header, params, { defaults })
  const { fields, shave } = await prompt.run({ autosubmit })
  output.push({ tag: 'writing' })
  const promises = []
  for await (const { tag, data } of ipc.dump({ link, dir: '-' })) {
    if (tag === 'error') {
      throw ERR_OPERATION_FAILED('Dump Failed: ' + data.stack)
    }
    if (tag !== 'file') continue
    const { key, value = null } = data
    if (key === '/_template.json') continue
    if (value === null) continue // dir
    const file = stamp.sync(key, fields)
    const writeStream = dst.createWriteStream(file)
    const promise = pipelinePromise(
      stamp.stream(value, fields, shave),
      writeStream
    )
    promise.catch((err) => {
      output.push({ tag: 'error', data: err })
    })
    promise.then(() => {
      output.push({ tag: 'wrote', data: { path: file } })
    })
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
