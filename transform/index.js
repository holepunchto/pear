/* global Pear */
import Module from 'bare-module'
import FramedStream from 'framed-stream'
import { isWindows } from 'which-runtime'

const pipe = Pear.worker.pipe()
const stream = new FramedStream(pipe)

let transforms = []
let bundles = []
let buffer = null

let timer = null

stream.on('data', (data) => {
  timeout(10_000)

  if (transforms.length === 0) {
    transforms = JSON.parse(data.toString())
    return
  }

  if (bundles.length > 0 && bundles.length === transforms.length) {
    if (!buffer) buffer = data

    buffer = bundles.reduce((source, bundle, index) => {
      const config = transforms[index]
      const { options = {} } = typeof config === 'string' ? {} : config
      const root = isWindows ? 'file:///c:' : 'file://'
      const transform = Module.load(new URL(root + '/transform.bundle'), bundle).exports

      return transform(source, options)
    }, buffer)

    stream.write(buffer)

    transforms = []
    bundles = []
    buffer = null
    return
  }

  bundles.push(data)
})
stream.on('end', () => {
  pipe.end()
  Pear.exit()
})
stream.on('error', (err) => console.error(err))

function timeout (ms) {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (transforms.length === 0) stream.end()
  }, ms)
}
