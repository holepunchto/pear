const Bundle = require('bare-bundle')
const FramedStream = require('framed-stream')
const b4a = require('b4a')
const path = require('bare-path')
const Worker = require('../../../lib/worker')

module.exports = class Transformer {
  app = null
  worker = null
  pipe = null
  stream = null
  #queue = null

  constructor (app) {
    this.app = app
    this.worker = new Worker()
    this.#queue = Promise.resolve()
  }

  run (link, args) {
    this.pipe = this.worker.run(link, args, { stdio: ['ignore', 'ignore', 'ignore'] })
    this.stream = new FramedStream(this.pipe)
  }

  close () {
    console.log('closing transformer...')
    this.#queue = null
    this.stream.end()
    this.pipe.end()
  }

  queue (transforms, buffer, next) {
    this.#queue = this.#queue.then(() => this.transform(transforms, buffer)).then(next)
    return this.#queue
  }

  get isClosed () {
    return this.#queue === null
  }

  async transform (transforms, buffer) {
    if (transforms.length === 0) return buffer

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

    const transformedBuffer = await new Promise((resolve) => {
      stream.once('data', (data) => {
        resolve(data)
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
