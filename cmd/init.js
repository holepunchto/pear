'use strict'
const os = require('bare-os')
const { access, writeFile, mkdir, readFile } = require('bare-fs/promises')
const { extname, basename, resolve } = require('bare-path')
const { ansi, print, interact } = require('./iface')
const constants = require('../lib/constants')
const parse = require('../lib/parse')

module.exports = (ipc) => async function init (args) {
  const { banner } = require('./usage')(constants.CHECKOUT)
  const cwd = os.cwd()
  const { _, yes, force, type = 'desktop' } = parse.args(args, {
    string: ['type'],
    boolean: ['yes', 'force'],
    alias: {
      yes: 'y',
      from: 'f',
      type: 't'
    }
  })

  const exists = async (path) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }
  const dir = _[0] || cwd
  const pkgPath = resolve(dir, 'package.json')
  let pkg = null
  try { pkg = JSON.parse(await readFile(pkgPath)) } catch {}

  const cfg = pkg?.pear || pkg?.holepunch || {}
  const height = cfg.gui ? cfg.gui.height : 540
  const width = cfg.gui ? cfg.gui.width : 720

  if (cfg.gui) {
    delete cfg.gui.backgroundColor
    delete cfg.gui.height
    delete cfg.gui.width
  }

  const initKeys = new Set(['name', 'version', 'description', 'main', 'type', 'scripts', 'pear', 'author', 'license'])

  const diff = pkg ? Object.fromEntries(Object.entries(pkg).filter(([key]) => initKeys.has(key) === false)) : {}

  const name = cfg?.name || pkg?.name || basename(cwd)

  const scripts = pkg?.scripts || { dev: 'pear dev', test: 'brittle test/*.test.js' }
  const extra = cfg.gui || {}

  const header = `${banner}${ansi.dim('›')}
    ${pkg === null ? '' : ansi.bold('\nExisting package.json detected, will merge')}
    ${force ? ansi.bold('\n🚨 FORCE MODE ENGAGED: ENSURE SURETY\n') : ''}`

  const desktopEntry = `<!DOCTYPE html>
<html>
<head>
  <style>body > h1:nth-of-type(1) { cursor: pointer }</style>
  <script type='module' src='./app.js'></script>
</head>
<body>
  <h1>${name}</h1>
</body>
</html>
`

  const terminalEntry = `const { versions } = Pear
console.log('Pear terminal application running')
console.log(await versions())
`
  const test = 'import test from \'brittle\' // https://github.com/holepunchto/brittle\n'

  const appJs = 'document.querySelector(\'h1\').addEventListener(\'click\', (e) => { e.target.innerHTML = \'🍐\'})'

  const desktopParams = [
    {
      name: 'main',
      default: 'index.html',
      prompt: 'main',
      type: 'desktop',
      validation: (value) => extname(value) === '.js' || extname(value) === '.html',
      msg: 'must have an .html or .js file extension'
    },
    {
      name: 'height',
      default: height,
      validation: (value) => Number.isInteger(+value),
      prompt: 'height',
      msg: 'must be an integer',
      type: 'desktop'
    },
    {
      name: 'width',
      default: width,
      validation: (value) => Number.isInteger(+value),
      prompt: 'width',
      msg: 'must be an integer',
      type: 'desktop'
    }
  ]

  const terminalParams = [
    {
      name: 'main',
      default: 'index.js',
      prompt: 'main',
      type: 'terminal',
      validation: (value) => extname(value) === '.js',
      msg: 'must have an .js file extension'
    }
  ]

  const params = [
    {
      name: 'type',
      default: 'desktop',
      validation: (value) => value === 'desktop' || value === 'terminal',
      prompt: 'type',
      msg: 'type must be "desktop" or "terminal"'

    },
    {
      name: 'name',
      default: name,
      prompt: 'name'

    },
    ...desktopParams,
    ...terminalParams,
    {
      name: 'license',
      default: pkg?.license || 'Apache-2.0',
      prompt: 'license'
    }
  ]

  try {
    const prompt = interact(header, params, type)
    const { result, fields } = await prompt.run({ autosubmit: yes })
    result.scripts = scripts
    if (fields.type === 'desktop') result.gui = { ...extra, ...result.gui }
    const created = pkg === null ? [pkgPath] : []
    const refusals = []
    const entryPath = resolve(dir, fields.main)
    const appPath = resolve(dir, 'app.js')
    const testDir = resolve(dir, 'test')
    const testPath = resolve(testDir, 'index.test.js')
    const isDesktop = fields.type === 'desktop'

    if (force || await exists(entryPath) === false) {
      await writeFile(entryPath, isDesktop ? desktopEntry : terminalEntry)
      created.push(entryPath)
    } else {
      refusals.push(entryPath)
    }
    if (isDesktop) {
      if (force || await exists(appPath) === false) {
        await writeFile(appPath, appJs)
        created.push(appPath)
      } else {
        refusals.push(appPath)
      }
      if (force || await exists(testPath) === false) {
        await mkdir(testDir, { recursive: true })
        await writeFile(testPath, test)
        created.push(testPath)
      } else {
        refusals.push(testPath)
      }
    }

    const final = JSON.stringify({ ...result, ...diff }, 0, 2)
    await writeFile(pkgPath, final)
    print(`\n ${final.split('\n').join('\n ')}\n`)
    if (created.length > 0) print(`${ansi.bold('Created')}:-\n\n  * ${created.join('\n  * ')}\n`)
    if (refusals.length) print(`${ansi.bold('Refusing to overwrite')}:-\n${ansi.dim('  Can be overriden with --force.\n')}\n  * ${refusals.join('\n  * ')}\n`)
    if (pkg) print(`${ansi.bold('Updated')}: ${pkgPath}\n`)
    Bare.exit()
  } catch (err) {
    print(err.stack, false)
  }
}
