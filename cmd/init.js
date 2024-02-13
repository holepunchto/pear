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
  const backgroundColor = cfg.gui ? cfg.gui.backgroundColor : '#1F2430'
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

  const scripts = pkg?.scripts
    ? `${JSON.stringify(pkg.scripts, 0, 6).slice(0, -1)}    }`
    : `{
        "dev": "pear dev",
        "test": "brittle test/*.test.js"
      }`

  const extra = cfg.gui && Object.keys(cfg.gui).length > 0 ? `,\n${JSON.stringify(cfg.gui, 0, 8).slice(2, -2)}` : ''

  const header = `${banner}${ansi.dim('›')}

    [ configure package.json ]
    ${pkg === null ? '' : ansi.bold('\nExisting package.json detected, will merge\n')}
    ${ansi.dim('exit: ctrl^c  select: tab/shift^tab  submit: return')}${force ? ansi.bold('\n\n    🚨 FORCE MODE ENGAGED: ENSURE SURETY') : ''}
  `

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

  const desktopTemplate = `
    {
      "name": "$name",
      "main": "$main",
      "type": "module",
      "scripts": ${scripts},
      "pear": {
        "name": "$pear-name",
        "type": "$type",
        "gui": {
          "backgroundColor": "$backgroundColor",
          "height": $height,
          "width": $width${extra}
        }
      },
      "author": "$author",
      "license": "$license",
      "devDependencies": {
        "brittle": "^3.0.0"
      }
    }
`

  const terminalTemplate = `
    {
      "name": "$name",
      "main": "$main",
      "type": "module",
      "scripts": ${scripts},
      "pear": {
        "name": "$pear-name",
        "type": "$type"${extra}
      },
      "author": "$author",
      "license": "$license",
      "devDependencies": {
        "brittle": "^3.0.0"
      }
    }
`
  const desktopParams = [
    {
      name: 'name',
      default: name
    },
    {
      name: 'main',
      default: pkg?.main || 'index.html',
      valid: (v) => extname(v) === '.html' || extname(v) === '.js',
      vmsg: 'must have an .html or .js file extension'
    },
    {
      name: 'pear-name',
      default: name
    },
    {
      name: 'type',
      default: 'desktop',
      valid: (v) => v === 'desktop' || v === 'terminal',
      vmsg: 'must be "desktop" or "terminal"'
    },
    {
      name: 'backgroundColor',
      default: backgroundColor
    },
    {
      name: 'height',
      default: height,
      valid: (h) => Number.isInteger(+h),
      vmsg: 'must be an integer'
    },
    {
      name: 'width',
      default: width,
      valid: (h) => Number.isInteger(+h),
      vmsg: 'must be an integer'
    },
    {
      name: 'author',
      default: pkg?.author || ''
    },
    {
      name: 'license',
      default: pkg?.license || 'MIT'
    }
  ]

  const terminalParams = [
    {
      name: 'name',
      default: name
    },
    {
      name: 'main',
      default: pkg?.main || 'index.js',
      valid: (v) => extname(v) === '.js',
      vmsg: 'must have an .js file extension'
    },
    {
      name: 'pear-name',
      default: name
    },
    {
      name: 'type',
      default: 'terminal',
      valid: (v) => v === 'desktop' || v === 'terminal',
      vmsg: 'must be "desktop" or "terminal"'
    },
    {
      name: 'author',
      default: pkg?.author || ''
    },
    {
      name: 'license',
      default: pkg?.license || 'MIT'
    }
  ]

  try {
    const prompt = interact(desktopTemplate, terminalTemplate, desktopParams, terminalParams, header)
    const { result, fields } = await prompt.run(type, { autosubmit: yes })
    const created = pkg === null ? [pkgPath] : []
    const refusals = []
    const entryPath = resolve(dir, fields.main.value)
    const appPath = resolve(dir, 'app.js')
    const testDir = resolve(dir, 'test')
    const testPath = resolve(testDir, 'index.test.js')
    const isDesktop = fields.type.value === 'desktop'

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

    const final = JSON.stringify({ ...JSON.parse(result), ...diff }, 0, 2)
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
