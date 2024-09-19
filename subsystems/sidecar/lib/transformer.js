const Bundle = require('bare-bundle')
const FramedStream = require('framed-stream')
const b4a = require('b4a')
const path = require('bare-path')
const picomatch = require('picomatch')
const Worker = require('../../../lib/worker')
const { ERR_TRANSFORM_FAILED } = require('../../../errors')

module.exports = class Transformer {
  app = null
  worker = null
  pipe = null
  stream = null
  #queue = null

  constructor (app, link, args) {
    if (app.transformer) return app.transformer

    this.app = app
    this.link = link
    this.args = args
    app.transformer = this
  }

  open () {
    this.#queue = Promise.resolve()
    this.worker = new Worker()
    this.pipe = this.worker.run(this.link, this.args, { stdio: 'inherit' })
    this.stream = new FramedStream(this.pipe)
    this.stream.on('end', () => this.stream.end())
  }

  close () {
    this.#queue = null
    this.worker = null
    this.pipe.end()
    this.stream.end()
  }

  queue (transforms, buffer, next) {
    this.#queue = this.#queue.then(() => this.transform(transforms, buffer)).then(next)
    return this.#queue
  }

  get isClosed () {
    return this.#queue === null
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

    if (this.isClosed) this.open()

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
      stream.once('data', (data) => {
        resolve(data)
      })

      stream.on('error', () => {
        reject(new ERR_TRANSFORM_FAILED(`Transform failed: ${filename}`))
      })

      pipe.on('crash', () => {
        reject(new ERR_TRANSFORM_FAILED(`Transform failed: ${filename}`))
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
}
