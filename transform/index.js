/* global Pear */
import Module from 'bare-module'
import FramedStream from 'framed-stream'
import { isWindows } from 'which-runtime'

const pipe = Pear.worker.pipe()
const stream = new FramedStream(pipe)

let transforms = []
let bundles = []
let buffer = null

stream.on('data', (data) => {
  if (transforms.length === 0) {
    try { transforms = JSON.parse(data.toString()) } catch (err) { console.error(err) }
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
stream.on('end', () => stream.end())
stream.on('error', (err) => console.error(err))
