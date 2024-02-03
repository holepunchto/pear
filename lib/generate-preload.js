import { PRELOADS, ROOT } from './constants.js'
import DriveBundler from 'drive-bundler'
import sodium from 'sodium-native'
import path from 'bare-path'
import fs from 'bare-fs'

export default async function gen (drive) {
  const b = await DriveBundler.bundle(drive, {
    entrypoint: '/lib/preload.cjs',
    cwd: ROOT,
    absolutePrebuilds: true
  })

  const src = cjsBundle(b.entrypoint, b.sources, b.resolutions)

  const name = 'preload@' + hash(src) + '.cjs'
  const out = path.join(PRELOADS, name)

  try {
    await fs.promises.stat(out)
    return out
  } catch {}

  await fs.promises.mkdir(PRELOADS, { recursive: true })
  const tmp = out + '.' + Date.now() + '.' + Math.random().toString(16).slice(2) + '.tmp'

  await fs.promises.writeFile(tmp, src)

  try {
    await fs.promises.rename(tmp, out)
  } catch {
    await fs.promises.stat(out)
  }

  return out
}

function cjsBundle (entrypoint, sources, resolutions) {
  let src = 'const __pear__ = {\n'
  src += '  modules: Object.create(null),\n'
  src += '  addons: new Map(),\n'
  src += '  builtins: new Set(typeof require !== "undefined" ? require("module").builtinModules : []),\n'
  src += '  builtinRequire: typeof require !== "undefined" ? require : () => {},\n'
  src += '  define (key, map, fn) {\n'
  src += '    const mod = __pear__.modules[key] = {\n'
  src += '      evaluated: false,\n'
  src += '      exports: {},\n'
  src += '      dirname: key.slice(0, key.lastIndexOf("/")),\n'
  src += '      filename: key,\n'
  src += '      evaluate () {\n'
  src += '        if (mod.evaluated) return\n'
  src += '        mod.evaluated = true\n'
  src += '        require.cache = __pear__.modules\n'
  src += '        require.addon = function addon (dir = ".") {\n'
  src += '          const u = new URL(dir, "file://" + key)\n'
  src += '          if (!__pear__.addons.has(u.pathname)) throw new Error("Cannot find addon " + dir + " from " + u.pathname)\n'
  src += '          const a = new URL(__pear__.addons.get(u.pathname))\n'
  src += '          return __pear__.builtinRequire(a.pathname)\n'
  src += '        }\n'
  src += '        require.resolve = function resolve (req) {\n'
  src += '          if (__pear__.builtins.has(req)) return req\n'
  src += '          if (Object.hasOwn(map, req)) return map[req]\n'
  src += '          throw new Error("Could not find module " + req + " from " + key)\n'
  src += '        }\n'
  src += '        fn(mod, mod.exports, require, mod.dirname, mod.filename)\n'
  src += '        function require (req) {\n'
  src += '          if (__pear__.builtins.has(req)) return __pear__.builtinRequire(req)\n'
  src += '          const key = require.resolve(req)\n'
  src += '          const mod = __pear__.modules[key]\n'
  src += '          if (!mod.evaluated) mod.evaluate()\n'
  src += '          return mod.exports\n'
  src += '        }\n'
  src += '      }\n'
  src += '    }\n'
  src += '  },\n'
  src += '  bootstrap (key) {\n'
  src += '    __pear__.modules[key].evaluate()\n'
  src += '  }\n'
  src += '}\n\n'

  for (const [key, map] of Object.entries(resolutions)) {
    const s = sources[key]
    if (s) {
      src += '__pear__.define(' + JSON.stringify(key) + ', ' + JSON.stringify(map) +
        ', function (module, exports, require, __dirname, __filename) {\n' + s + '\n})\n'
    }
    const b = map['bare:addon']
    if (b) {
      src += '__pear__.addons.set(' + JSON.stringify(key) + ', ' + JSON.stringify(b) + ')\n'
    }
  }

  src += '__pear__.bootstrap(' + JSON.stringify(entrypoint) + ')\n'

  return Buffer.from(src)
}

function hash (src) {
  const out = Buffer.allocUnsafe(32)
  sodium.crypto_generichash(out, src)
  return out.toString('hex')
}
