/* global Bare */
const Signal = require('bare-signals')
const safetyCatch = require('safety-catch')

const handlers = []

let exiting = false

const sigint = new Signal('SIGINT')
const sigterm = new Signal('SIGTERM')

sigint
  .on('signal', (signum) => {
    sigint.stop()
    sigint.unref()
    Bare.exitCode = 130
    onexit(() => { Signal.send(signum, Bare.pid) })
  })

sigterm
  .on('signal', (signum) => {
    sigterm.stop()
    sigterm.unref()
    Bare.exitCode = 143
    onexit(() => { Signal.send(signum, Bare.pid) })
  })

function onexit (ondone) {
  if (exiting) return
  exiting = true

  Bare.removeListener('beforeExit', onexit)

  const order = []

  for (const h of handlers.sort((a, b) => b.position - a.position)) {
    if (!order.length || order[order.length - 1][0].position !== h.position) order.push([])
    order[order.length - 1].push(h)
  }

  const loopdown = loop()

  if (ondone) loopdown.finally(ondone)

  function loop () {
    if (!order.length) return
    return Promise.allSettled(order.pop().map(run)).then(loop, loop)
  }
}

async function run (h) {
  try {
    await h.fn()
  } catch (e) {
    safetyCatch(e)
  }
}

function setup () {
  Bare.prependListener('beforeExit', onexit)
  sigint.start()
  sigterm.start()

  sigint.unref()
  sigterm.unref()
}

function cleanup () {
  Bare.removeListener('beforeExit', onexit)
  sigint.close()
  sigterm.close()
}

function teardown (fn, position = 0) {
  if (handlers.length === 0) setup()
  const handler = { position, fn }
  handlers.push(handler)

  return function unregister () {
    const i = handlers.indexOf(handler)
    if (i > -1) handlers.splice(i, 1)
    if (!handlers.length) cleanup()
  }
}

module.exports = teardown
