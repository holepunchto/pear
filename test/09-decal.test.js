'use strict'
const { join } = require('path')
const { createRequire } = require('module')
const { readFileSync } = require('fs')
const { readFile } = require('fs/promises')
const test = require('brittle')
const joyrider = require('joyrider')
const rider = joyrider(__filename)

const testAvatar = `data:image/png;base64,${(readFileSync(join(__dirname, 'fixtures', 'test.png'))).toString('base64')}`

test('loader displays platform name', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({
    inspect: 'decal.html'

  })

  const element = await inspect.querySelector('#holepunch')

  is(await inspect.innerHTML(element), 'Holepunch')
})

test('loader displays tagline', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({
    inspect: 'decal.html'
  })

  const element = await inspect.querySelector('#tagline')

  is(await inspect.innerHTML(element), 'The Internet of Peers')
})

test('loader displays progress bar', async ({ teardown, is, ok }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({ inspect: 'decal.html' })
  const element = await inspect.querySelector('#progress')
  is(typeof await inspect.value(element), 'number')
  ok(await inspect.querySelector('#phaser'))
})

// fixme: freezes on preferences iter.next if not only test
test.skip('title bar avatar', async ({ teardown, is, ok }) => {
  const ride = await rider({
    // show: true,
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({ inspect: 'decal.html' })

  const element = await inspect.querySelector('#avatar')

  const { isSVG = false } = await inspect.describe(element)

  ok(isSVG, 'default avatar displayed')

  await inspect.run(`
    const app = await import('${inspect.specifier('holepunch:app')}')
    const iter = app.preferences()
    app.preferences.set('avatar', '${testAvatar}')
    await iter.next()
  `)

  const { src } = await inspect.attributes(await inspect.querySelector('#avatar'))

  is(src, testAvatar)
})

// TODO: fixme
// test.skip('title bar tier (dev)', async ({ teardown, is }) => {
//   const ride = await rider({
//     show: true,
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'decal-test' }
//   })
//   const inspect = await ride.open({ inspect: 'decal.html', enhance: interceptIPC(ride.platformDir) })

//   inspect.hooks.afterViewLoaded()

//   const element = await inspect.querySelector('decal-tier [slot=tier]')
//   let result = null
//   while (true) if (result = await inspect.innerText(element)) break

//   is(result, 'DEV')
// })

// TODO: fixme
// test.skip('title bar tier (staging)', async ({ teardown, is }) => {
//   const ride = await rider({
//     show: true,
//     teardown,
//     app: './fixtures/app',
//     vars: { name: 'decal-test' }
//   })
//   const inspect = await ride.open({
//     from: 'staged',
//     inspect: 'decal.html',
//     enhance: interceptIPC(ride.platformDir)
//   })

//   const element = await inspect.querySelector('decal-tier [slot=tier]')
//   let result = null
//   while (true) if (result = await inspect.innerText(element)) break

//   is(result, 'STAGING')
// })

// TODO: fixme
test.skip('title bar tier (production)', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({
    from: 'released',
    inspect: 'decal.html',
    enhance: interceptIPC(ride.platformDir)
  })

  const element = await inspect.querySelector('decal-tier [slot=tier]')

  // production tier scenario is where we nothing
  // we're checking for absence of an operation, making sure with a viable timeout:
  await new Promise((resolve) => setTimeout(resolve, 500))

  is((await inspect.innerText(element)), '')
})

// TODO: fixme
test.skip('title bar update notification', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({
    inspect: 'decal.html',
    enhance: interceptIPC(ride.platformDir, (ipc, control, defaultModify) => {
      defaultModify()
      ipc.core.notifications = async function * () {
        control.notifications.called()
        yield * control.notifications.generator()
      }
      return ipc
    })
  })

  await inspect.hooks.afterViewLoaded()

  const bar = await inspect.querySelector('#bar')

  await inspect.after('subtree-modified', bar)

  await inspect.hooks.notifications({ value: { type: 'update' } })

  is((await inspect.innerText(await inspect.querySelector('decal-notifications [slot=content]'))), 'UPDATE AVAILABLE')
  is((await inspect.innerText(await inspect.querySelector('decal-notifications [slot=info]'))), 'RESTART APP TO UPDATE')
})

// TODO: fixme
test.skip('background color sync', async ({ teardown, is }) => {
  const ride = await rider({
    teardown,
    app: './fixtures/app',
    vars: { name: 'decal-test' }
  })
  const inspect = await ride.open({
    inspect: 'decal.html',
    enhance: interceptIPC(ride.platformDir, (ipc, control, defaultModify) => {
      defaultModify()
      const { once, on } = ipc.decal.intra.events
      ipc.decal.intra.events.once = function (ns, fn) {
        if (ns === 'bg') {
          fn({}, 'rgb(42, 69, 42)')
          return
        }
        return once.call(this, ns, fn)
      }
      ipc.decal.intra.events.on = function (ns, fn) {
        if (ns === 'bg') {
          control.bg.promise.then(() => fn({}, 'rgb(69, 42, 69)'))
          return
        }
        return on.call(this, ns, fn)
      }
      return ipc
    })
  })

  const body = await inspect.querySelector('body')

  let breakpoint = inspect.after('attribute-modified', body)

  await inspect.hooks.progress({ value: 100, done: true })

  await inspect.hooks.ready()

  await breakpoint

  breakpoint = inspect.after('attribute-modified', body)

  is(await inspect.computedStyle(body, 'background-color'), 'rgb(42, 69, 42)')

  await inspect.hooks.bg()

  await breakpoint

  is(await inspect.computedStyle(body, 'background-color'), 'rgb(69, 42, 69)')
})

// specialized helper util:
function interceptIPC (platformDir, modify) {
  const defaultModify = (ipc, control) => {
    ipc.gui.afterViewLoaded = async () => {
      control.afterViewLoaded.called()
      return control.afterViewLoaded.promise
    }
    return ipc
  }
  modify = modify || defaultModify
  return async function prepare (protocol) {
    const { Fetch } = protocol
    await Fetch.enable({
      patterns: [{ urlPattern: '*ipc/renderer.js+holepunch+esm*' }]
    })

    const { resolve } = createRequire(platformDir + '/')
    const rendererIpc = await readFile(resolve('../ipc/renderer.js'), { encoding: 'utf8' })
    Fetch.requestPaused((req) => {
      Fetch.fulfillRequest({
        requestId: req.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; utf-8' }],
        body: Buffer.from(`
          import { createRequire } from './~module'
          const control = window.__TEST_IPC_CONTROL__ = {}
          class Iter {
            constructor () {
              this.calledPromise = new Promise((resolve) => { this.called = resolve })
            }
            async * generator () { 
              do {
                const next = new Promise((resolve) => { this.push = resolve })
                const { value, done } = await next
                yield value
                if (done) break
              } while (true)
            }
          }
          class Defer {
            constructor () {
              this.calledPromise = new Promise((resolve) => { this.called = resolve })
              this.promise = new Promise((resolve) => { this.resolve = resolve } )
            }
          }
          control.notifications = new Iter()
          control.afterViewLoaded = new Defer()
          control.bg = new Defer()
          control.exit = new Defer()
          control.quit = new Defer()
          const require = createRequire(import.meta.url)
          export default function ipc (id = window[Symbol.for('pear.id')]) {
            return(function (module) {
              ${rendererIpc}
              return module.exports
            })({})(id)
            const modify = ${modify}
            return modify(original, control, () => { return (${defaultModify})(original, control) })
          }
        `).toString('base64')
      })
    })
    return new class {
      #run (expression) { return protocol.Runtime.evaluate({ replMode: true, expression, returnByValue: true, awaitPromise: true }) }

      bg () {
        return this.#run('window.__TEST_IPC_CONTROL__.bg.resolve()')
      }

      afterViewLoaded () {
        return this.#run('window.__TEST_IPC_CONTROL__.afterViewLoaded.resolve()')
      }

      notifications (o) {
        return this.#run(`
          window.__TEST_IPC_CONTROL__.notifications.push(${JSON.stringify(o)})
        `)
      }

      quit () {
        return this.#run('window.__TEST_IPC_CONTROL__.quit.resolve()')
      }

      afterViewLoadedCalled () {
        return this.#run('await window.__TEST_IPC_CONTROL__.afterViewLoaded.calledPromise')
      }

      notificationsCalled () {
        return this.#run('await window.__TEST_IPC_CONTROL__.notifications.calledPromise')
      }

      quitCalled () {
        return this.#run('await window.__TEST_IPC_CONTROL__.quit.calledPromise')
      }
    }()
  }
}
