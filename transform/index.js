'use strict'
/* global Pear */
const Module = require('bare-module')
const FramedStream = require('framed-stream')
const b4a = require('b4a')

const pipe = Pear.worker.pipe()
const stream = new FramedStream(pipe)

const readyFrame = b4a.from([0x01])
stream.write(readyFrame)

let transforms = []
let bundles = []
let buffer = null

let timer = null

stream.on('data', (data) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (transforms.length === 0) {
      stream.end()
      pipe.end()
    }
  }, 10_000)

  if (transforms.length === 0) {
    transforms = JSON.parse(data.toString())
    return
  }

  if (bundles.length > 0 && bundles.length === transforms.length) {
    if (!buffer) buffer = data

    /* eslint-disable-next-line array-callback-return */
    buffer = bundles.reduce((source, bundle, index) => {
      const config = transforms[index]
      const { options = {} } = typeof config === 'string' ? {} : config
      const name = typeof config === 'string' ? config.split('.')[0] : config.name
      try {
        const transform = Module.load(new URL(`pear-transform:/${name}.bundle`), bundle).exports
        return transform(source, options)
      } catch (err) {
        clearTimeout(timer)
        stream.destroy()
        pipe.end()
        Pear.exit(1)
      }
    }, buffer)

    stream.write(buffer)

    transforms = []
    bundles = []
    buffer = null
    return
  }

  bundles.push(data)
})

stream.on('error', () => {
  clearTimeout(timer)
  stream.destroy()
  pipe.end()
  Pear.exit(1)
})

stream.on('end', () => {
  clearTimeout(timer)
  pipe.end()
})
