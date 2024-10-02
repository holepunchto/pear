const { isBare } = require('which-runtime')
const path = isBare ? require('bare-path') : require('path')
const Bundle = require('bare-bundle')
const FramedStream = require('framed-stream')
const b4a = require('b4a')
const picomatch = require('picomatch')
const ReadyResource = require('ready-resource')
const Worker = require('./lib/worker')
const { ERR_TRANSFORM_FAILED, ERR_INVALID_CONFIG } = require('./errors')
const TRANSFORM_MAX_WAIT = 5000

module.exports = class Transformer extends ReadyResource {
  app = null
  worker = null
  pipe = null
  stream = null

  constructor (app, link, args) {
    super()
    if (app.transformer) return app.transformer

    this.app = app
    this.link = link
    this.args = args

    app.transformer = this
  }

  async _open () {
    this.worker = new Worker({ carry: false })
    this.pipe = this.worker.run(this.link, this.args, { stdio: ['ignore', 'pipe', 'pipe'] })
    this.stream = new FramedStream(this.pipe)
    this.stream.on('end', () => this.stream.end())

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ERR_TRANSFORM_FAILED('Transform worker did not reply in time'))
      }, TRANSFORM_MAX_WAIT)

      this.stream.once('data', (data) => {
        clearTimeout(timeout)
        if (data.equals(b4a.from([0x01]))) {
          resolve(data) // worker is ready
        } else {
          reject(new ERR_TRANSFORM_FAILED('Unexpected data received from worker'))
        }
      })
    })
  }

  async _close () {
    this.worker = null
    this.pipe.end()
    this.stream.end()
  }

  async transform (buffer, filename) {
    const transforms = []
    const patterns = this.app.state?.transforms
    for (const ptn in patterns) {
      const isMatch = picomatch(ptn)
      if (isMatch(filename)) {
        transforms.push(...patterns[ptn])
      }
    }
    if (transforms.length === 0) return null

    const pipe = this.pipe
    const stream = this.stream
    stream.write(b4a.from(JSON.stringify(transforms)))

    for (const transform of transforms) {
      const { name: transformName } = typeof transform === 'string' ? { name: transform } : transform
      let normalizedPath = path.normalize(transformName)
      const hasExtension = path.extname(normalizedPath) !== ''
      if (!hasExtension) normalizedPath = path.join('node_modules', normalizedPath)

      const bundle = await this.#bundle(normalizedPath)
      stream.write(bundle)
    }

    stream.write(buffer)

    const transformedBuffer = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ERR_TRANSFORM_FAILED(`Transform for ${filename} did not complete in time`))
      }, TRANSFORM_MAX_WAIT)

      stream.once('data', (data) => {
        clearTimeout(timeout)
        resolve(data)
      })

      stream.on('error', () => {
        clearTimeout(timeout)
        reject(new ERR_TRANSFORM_FAILED(`Transform failed for ${filename}`))
      })

      pipe.on('crash', (data) => {
        clearTimeout(timeout)
        reject(new ERR_TRANSFORM_FAILED(`Transform failed for ${filename}. Exit code: ${data.exitCode}`))
      })
    })

    return transformedBuffer
  }

  async #bundle (path) {
    const b = new Bundle()
    const res = {}
    const { entrypoint, resolutions, sources } = await this.app.bundle.bundle(path)

    for (const [key, map] of Object.entries(resolutions)) {
      res[key] = map
    }

    for (const [key, source] of Object.entries(sources)) {
      b.write(key, source)
    }

    b.main = entrypoint
    b.resolutions = res

    return b.toBuffer()
  }

  static validate (transforms) {
    if (!transforms) return null

    const validateString = (str) => {
      if (/^[@/a-zA-Z0-9-_.]+$/.test(str)) return str
      throw new ERR_INVALID_CONFIG('Invalid string in config. The string may only contain letters (a-z, A-Z), numbers (0-9), hyphens (-), underscores (_), forward slashes (/), asperands (@), and periods (.).')
    }
    const validatePattern = (pattern) => {
      if (/^[a-zA-Z0-9-_*?!.@/[\]{}()+^$\\|]+$/.test(pattern)) return pattern
      throw new ERR_INVALID_CONFIG(`Invalid pattern "${pattern}". Pattern contains invalid characters.`)
    }

    if (typeof transforms !== 'object') throw new ERR_INVALID_CONFIG('Transforms should be an object.')
    for (const pattern in transforms) {
      validatePattern(pattern)
      const transformArray = transforms[pattern]
      if (!Array.isArray(transformArray)) throw new ERR_INVALID_CONFIG(`Transforms for "${pattern}" should be an array.`)
      for (const transform of transformArray) {
        if (typeof transform === 'string') {
          validateString(transform)
          continue
        }
        if (typeof transform === 'object' && transform !== null) {
          if (!transform.name || typeof transform.name !== 'string') throw new ERR_INVALID_CONFIG(`Each transform in "${pattern}" should have a "name" field of type string.`)
          validateString(transform.name)

          if ('options' in transform && (typeof transform.options !== 'object' || transform.options === null)) {
            throw new ERR_INVALID_CONFIG(`The "options" field in "${pattern}" should be an object.`)
          }
          continue
        }
        throw new ERR_INVALID_CONFIG(`Invalid transform format in "${pattern}". Each transform should be either a string or an object.`)
      }
    }
    return transforms
  }
}
