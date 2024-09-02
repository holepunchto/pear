'use strict'
const { Readable } = require('streamx')
const Bundle = require('bare-bundle')
const DriveBundler = require('drive-bundler')
const path = require('bare-path')

function parse (template, locals) {
  const args = []
  const strings = []
  let last = 0
  template += ''
  for (const result of template.matchAll(/__([a-zA-Z/\\.:]*?)__/g)) {
    const [match, def] = result
    const [name] = def.split(':').map((s) => s.trim())
    const { index } = result
    args.push(locals[name] + '')
    strings.push(template.slice(last, index))
    last = index + match.length
  }
  strings.push(template.slice(last))
  return { strings, args }
}

function stream (template, locals) {
  const { strings, args } = parse(template, locals)
  return new Readable({
    objectMode: true,
    async read (cb) {
      try {
        for (let i = 0; i < strings.length; i++) {
          this.push(strings[i])
          if (i < args.length) for await (const chunk of interlope(await args[i])) this.push(chunk)
        }
        this.push(null)
        cb(null)
      } catch (err) {
        cb(err)
      }
    }
  })
}

function interlope (arg) {
  return new Readable({
    objectMode: true,
    async read (cb) {
      try {
        if (arg === null || typeof arg !== 'object') {
          this.push(arg)
        } else if (Array.isArray(arg)) {
          for (const item of arg) {
            if (item === arg) continue
            for await (const chunk of interlope(item)) this.push(chunk)
          }
        } else if (typeof arg[Symbol.asyncIterator] === 'function') {
          for await (const chunk of arg) this.push(chunk)
        } else {
          this.push(await arg)
        }
        this.push(null)
        cb(null)
      } catch (err) {
        this.destroy(err)
        cb(err)
      }
    }
  })
}

function sync (template, locals) {
  const { strings, args } = parse(template, locals)
  return String.raw({ raw: strings }, ...args)
}

class Pipeline {
  #drive = null
  constructor (drive) {
    this.#drive = drive
  }

  run = async (buffer, transforms) => {
    for (const input of transforms) {
      let normalizedPath = path.normalize(input)
      const hasExtension = path.extname(normalizedPath) !== ''
      if (!hasExtension) normalizedPath = path.join('node_modules', normalizedPath)

      try {
        const { _main: mainEntryPoint, _files: files, _resolutions: resolutions } = await this.#bundle(normalizedPath)

        const moduleCache = {}

        function resolveModule (request, parentPath) {
          const baseDir = path.dirname(parentPath)
          let resolvedPath = path.resolve(baseDir, request)

          if (!files.has(resolvedPath)) {
            if (resolutions[parentPath] && resolutions[parentPath][request]) {
              resolvedPath = resolutions[parentPath][request]
            } else {
              throw new Error(`Module not found: ${request}`)
            }
          }

          return resolvedPath
        }

        function evaluate (request, parentPath = mainEntryPoint) {
          const resolvedPath = resolveModule(request, parentPath)

          if (moduleCache[resolvedPath]) {
            return moduleCache[resolvedPath].exports
          }

          if (files.has(resolvedPath)) {
            const codeBuffer = files.get(resolvedPath)
            const code = codeBuffer.toString('utf-8')

            if (resolvedPath.endsWith('.json')) {
              moduleCache[resolvedPath] = { exports: JSON.parse(code) }
              return moduleCache[resolvedPath].exports
            }

            const module = { exports: {} }
            moduleCache[resolvedPath] = module

            try {
              // eslint-disable-next-line no-new-func
              const moduleFunction = new Function('module', 'exports', 'require', '__filename', '__dirname', code)
              moduleFunction(module, module.exports, (req) => evaluate(req, resolvedPath), resolvedPath, path.dirname(resolvedPath))
            } catch (error) {
              console.error('Error executing code for:', resolvedPath)
              console.error('Code:', code)
              throw error
            }
            return module.exports
          } else {
            throw new Error(`Module not found: ${resolvedPath}`)
          }
        }

        const transform = evaluate(mainEntryPoint)

        buffer = transform(buffer)
      } catch (err) {
        console.error('Error during transformation:', err)
      }
    }
    return buffer
  }

  #bundle = async (ep) => {
    const b = new Bundle()
    const res = {}

    const { entrypoint, resolutions, sources } = await DriveBundler.bundle(this.#drive, { entrypoint: ep, absolutePrebuilds: false })

    for (const [key, map] of Object.entries(resolutions)) {
      res[key] = map
    }

    for (const [key, source] of Object.entries(sources)) {
      b.write(key, source)
    }

    b.main = entrypoint
    b.resolutions = res

    return b
  }
}

module.exports = { stream, sync, Pipeline }
