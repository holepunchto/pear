'use strict'
const test = require('brittle')
const joyrider = require('joyrider')

const rider = joyrider(__filename)

test('gui.View.self getMediaSourceId', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        export const id = await view.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  const { id } = await parent.exports('test.js')

  const selfId = await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch:gui')}')
    await View.self.getMediaSourceId()
  `)
  is(selfId, id)
})

test('gui.View.self dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })

  await ride.open()

  const view = await ride.inspect('extra.html')

  const dimensions = await view.run(`
    const gui = await import('${view.specifier('holepunch:gui')}')
    await gui.View.self.dimensions()
  `)

  alike(await view.dimensions(), dimensions)
})

test('gui.View.self dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })

  await ride.open()

  const view = await ride.inspect('extra.html')

  const dimensions = { x: 100, y: 100, height: 10, width: 10 }

  await view.run(`
    const gui = await import('${view.specifier('holepunch:gui')}')
    await gui.View.self.dimensions({ x: 100, y: 100, height: 10, width: 10 })
  `)

  alike(await view.dimensions(), dimensions)
})

test('gui.View.parent isClosed', async ({ not, ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        global.gui = gui
        await view.open()
      `
    },
    teardown
  })
  await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.parent.isClosed()
  `))

  // there's no way, and no need, to check for isClosed=true with View.parent
  // because once the parent of a view is closed, so is the view
})

test('gui.View.parent hide', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await gui.View.self.show()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.verify()

  ok(await parent.visible())

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.parent.hide()
  `)

  not(await parent.visible())
})

test('gui.View.parent show', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await gui.View.self.hide()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  not(await parent.visible())

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.parent.show()
  `)

  ok(await parent.visible())
})

test('gui.View.parent blur', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        global.gui = gui
      `
    },
    teardown
  })
  const parent = await ride.open()

  const view = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.run('await gui.View.self.focus()')

  ok(await parent.focused())

  await view.run(`
    const { View } = await import('${view.specifier('holepunch://gui')}')
    await View.parent.blur()
  `)

  not(await parent.focused())
})

test('gui.View.parent focus', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        global.gui = gui
      `
    },
    teardown
  })
  const parent = await ride.open()

  const view = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.run('await gui.View.self.blur()')

  not(await parent.focused())

  await view.run(`
    const { View } = await import('${view.specifier('holepunch://gui')}')
    await View.parent.focus()
  `)

  ok(await parent.focused())
})

test('gui.View.parent dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })
  const win = await ride.open()

  await win.visible()

  const parent = await ride.inspect('index.html', { decal: true })

  const dimensions = await parent.dimensions()

  const child = await ride.inspect('extra.html')

  await child.visible()

  alike(await child.run(`
    await (await import('${child.specifier('holepunch:gui')}')).View.parent.dimensions()
  `), dimensions)
})

test('gui.View.parent dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })
  const win = await ride.open()

  await win.visible()

  const parent = await ride.inspect('index.html', { decal: true })

  const dimensions = { x: 100, y: 100, height: 100, width: 100 }

  const child = await ride.inspect('extra.html')

  await child.visible()

  await child.run(`
    await (await import('${child.specifier('holepunch:gui')}')).View.parent.dimensions({ x: 100, y: 100, height: 100, width: 100 })
  `)

  alike(await parent.dimensions(), dimensions)
})

test('gui.View.parent getMediaSourceId', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        export const id = await gui.View.self.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  const { id } = await parent.exports('test.js')

  const parentId = await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.parent.getMediaSourceId()
  `)

  is(id, parentId)
})

test('gui.View on message / gui.View.parent send', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        global.view = view
        let msg = null
        view.on('message', (message) => { msg = message })
        global.incomingMessage = new Promise((resolve) => {
          const interval = setInterval(() => {
            if (msg === null) return
            clearInterval(interval)
            resolve(msg)
          }, 100)
        })
        await view.open()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await child.run(`
    const { View } = await import('${child.specifier('holepunch://gui')}')
    View.parent.send('hello')
  `)

  is(await parent.run('await incomingMessage'), 'hello')
})

test('gui.View.parent on message / gui.View send', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        global.view = view
        await view.open()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await child.run(`
    const { View } = await import('${child.specifier('holepunch://gui')}')
    let msg = null
    View.parent.on('message', (message) => { msg = message })
    global.incomingMessage = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (msg === null) return
        clearInterval(interval)
        resolve(msg)
      }, 100)
    })
  `)

  await parent.run('view.send(\'hello\')')

  is(await child.run('await incomingMessage'), 'hello')
})

test('gui.View open', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })
  await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())
})

test('gui.View close', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        global.view = view
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())

  await parent.run('view.close()')

  not(await inspect.verify())
})

test('gui.View isClosed', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.close()
        export const isClosed = await view.isClosed()
      `
    },
    teardown
  })
  const parent = await ride.open()

  await ride.inspect('extra.html')
  const { isClosed } = await parent.exports('test.js')
  ok(isClosed)
})

test('gui.View hide', async ({ not, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.hide()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())
})

test('gui.View show', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.hide()
        global.view = view
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())

  await parent.run('view.show()')

  ok(await inspect.visible())
})

test('gui.View blur', async ({ ok, not, plan, teardown }) => {
  plan(4)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        global.view = view
        await view.open()
        await view.focus()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  // the contentView option inspects the actual view focus state, not the containing decal window
  ok(await inspect.focused({ contentView: true }))

  ok(await inspect.focused())

  await parent.run('view.blur()')

  not(await inspect.focused({ contentView: true }))

  // when a view is blurred, the window containing it remains focused:
  ok(await inspect.focused())
})

test('gui.View focus', async ({ ok, not, plan, teardown }) => {
  plan(6)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        global.view = view
        await view.open()
        await view.focus()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.focused({ contentView: true }))
  ok(await inspect.focused())

  await parent.run('view.blur()')

  not(await inspect.focused({ contentView: true }))
  ok(await inspect.focused())

  await parent.run('view.focus()')

  ok(await inspect.focused({ contentView: true }))
  // when a view is focused the parent window is also focused:
  ok(await inspect.focused())
})

test('gui.View isVisible', async ({ is, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        global.view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })

  const inspect = await ride.open()

  is(await inspect.run('await view.isVisible()'), true)

  await inspect.run('view.hide()')

  is(await inspect.run('await view.isVisible()'), false)
})

test('gui.View dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        export const dimensions = await view.dimensions()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html')

  const { dimensions } = await parent.exports('test.js')

  await child.visible()

  alike(await child.dimensions(), dimensions)
})

test('gui.View dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.dimensions({ x: 100, y: 100, width: 10, height: 10})
      `
    },
    teardown
  })

  await ride.open()

  const child = await ride.inspect('extra.html')

  const dimensions = { x: 100, y: 100, width: 10, height: 10 }

  await child.visible()

  alike(await child.dimensions(), dimensions)
})

test('gui.View getMediaSourceId', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.close()
        export const id = await view.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  await ride.inspect('extra.html')

  const { id } = await parent.exports('test.js')

  ok(id)
})

test('gui.View.self close', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.self.close()
  `)

  not(await inspect.verify())
})

test('gui.View.self show', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.hide()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.self.show()
  `)

  ok(await inspect.visible())
})

test('gui.View.self hide', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.show() // shows by default but this allows us to wait for shoviewg
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.visible())

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.self.hide()
  `)

  not(await inspect.visible())
})

test('gui.View.self focus', async ({ ok, not, plan, teardown }) => {
  plan(3)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.blur()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  // window will focus:
  ok(await inspect.focused())
  // view will be blurred:/
  not(await inspect.focused({ contentView: true }))

  await inspect.run(`
    const { View } = await import('${inspect.specifier('holepunch://gui')}')
    await View.self.focus()
  `)

  ok(await inspect.focused({ contentView: true }))
})

test('gui.View.self blur', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const view = new gui.View('./extra.html')
        await view.open()
        await view.focus()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.focused())

  ok(await inspect.focused({ contentView: true }))

  await inspect.run(`
    const { View } = await import('.${inspect.specifier('holepunch://gui')}')
    await View.self.blur()
  `)
})

test('gui.Window open', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
      `
    },
    teardown
  })
  await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())
})

test('gui.Window close', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        global.win = win
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())

  await parent.run('win.close()')

  not(await inspect.verify())
})

test('gui.Window isClosed', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.close()
        export const isClosed = await win.isClosed()
      `
    },
    teardown
  })
  const parent = await ride.open()

  await ride.inspect('extra.html')

  const { isClosed } = await parent.exports('test.js')

  ok(isClosed)
})

test('gui.Window hide', async ({ ok, not, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.hide()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())
})

test('gui.Window show', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.hide()
        global.win = win
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())

  await parent.run('win.show()')

  ok(await inspect.visible())
})

test('gui.Window blur', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        global.win = win
        await win.open()  // when opening, focuses by default
        await win.focus() // but this allows us to wait for the focus event
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.focused())

  await parent.run('win.blur()')

  not(await inspect.focused())
})

test('gui.Window focus', async ({ ok, not, plan, teardown }) => {
  plan(3)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        global.win = win
        await win.open()  // when opening, focuses by default
        await win.focus() // but this allows us to wait for the focus event
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.focused())

  await parent.run('win.blur()')

  not(await inspect.focused())

  await parent.run('win.focus()')

  ok(await inspect.focused())
})

test('gui.Window isVisible', async ({ is, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        global.win = new gui.Window('./extra.html')
        await win.open()
      `
    },
    teardown
  })

  const inspect = await ride.open()

  is(await inspect.run('await win.isVisible()'), true)

  await inspect.run('win.hide()')

  is(await inspect.run('await win.isVisible()'), false)
})

test('gui.Window dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        export const dimensions = await win.dimensions()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html', { decal: true })

  const { dimensions } = await parent.exports('test.js')

  await child.visible()

  alike(await child.dimensions(), dimensions)
})

test('gui.Window dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.dimensions({ x: 100, y: 100, width: 10, height: 10})
      `
    },
    teardown
  })

  await ride.open()

  const child = await ride.inspect('extra.html', { decal: true })

  const dimensions = { x: 100, y: 100, width: 10, height: 10 }

  await child.visible()

  alike(await child.dimensions(), dimensions)
})

test('gui.Window getMediaSourceId', async ({ ok, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.close()
        export const id = await win.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  await ride.inspect('extra.html')

  const { id } = await parent.exports('test.js')

  ok(id)
})

test('gui.Window.self close', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  ok(await inspect.verify())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.close()
  `)

  not(await inspect.verify())
})

test('gui.Window.self show', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.hide()
      `
    },
    teardown
  })

  await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.visible())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.show()
  `)

  ok(await inspect.visible())
})

test('gui.Window.self hide', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.show() // shows by default but this allows us to wait for showing
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.visible())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.hide()
  `)

  not(await inspect.visible())
})

test('gui.Window.self focus', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.blur()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  not(await inspect.focused())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.focus()
  `)

  ok(await inspect.focused())
})

test('gui.Window.self blur', async ({ ok, not, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.focus()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  ok(await inspect.focused())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.blur()
  `)

  not(await inspect.focused())
})

test('gui.Window.self getMediaSourceId', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        export const id = await win.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  const { id } = await parent.exports('test.js')

  const selfId = await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.self.getMediaSourceId()
  `)

  is(selfId, id)
})

test('gui.Window.self dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        export const dimensions = await gui.Window.self.dimensions()
      `
    },
    teardown
  })

  const view = await ride.open()

  await view.visible()

  const decal = await ride.inspect('index.html', { decal: true })

  const { dimensions } = await view.exports('test.js')

  alike(await decal.dimensions(), dimensions)
})

test('gui.Window.self dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        await gui.Window.self.dimensions({ x: 100, y: 100, height: 10, width: 10})
      `
    },
    teardown
  })

  const view = await ride.open()

  await view.visible()

  const decal = await ride.inspect('index.html', { decal: true })

  const dimensions = { x: 100, y: 100, height: 10, width: 10 }

  alike(await decal.dimensions(), dimensions)
})

test('gui.Window.parent isClosed', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        global.gui = gui
        await win.open()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  not(await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.isClosed()
  `))

  await parent.run('await gui.Window.self.close()')

  ok(await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.isClosed()
  `))
})

test('gui.Window.parent hide', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await gui.Window.self.show()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.verify()

  ok(await parent.visible())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.hide()
  `)

  not(await parent.visible())
})

test('gui.Window.parent show', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await gui.Window.self.hide()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  not(await parent.visible())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.show()
  `)

  ok(await parent.visible())
})

test('gui.Window.parent blur', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        window.gui = gui
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.visible()

  await parent.run('await gui.Window.self.focus()')

  ok(await parent.focused())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.blur()
  `)

  not(await parent.focused())
})

test('gui.Window.parent focus', async ({ not, ok, plan, teardown }) => {
  plan(2)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        await win.focus()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await parent.visible()

  not(await parent.focused())

  await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.focus()
  `)

  ok(await parent.focused())
})

test('gui.Window.parent dimensions (get)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
      `
    },
    teardown
  })
  const view = await ride.open()

  await view.visible()

  const parent = await ride.inspect('index.html', { decal: true })

  const dimensions = await parent.dimensions()

  const child = await ride.inspect('extra.html', { decal: true })

  await child.visible()

  alike(await child.run(`
    await (await import('${child.specifier('holepunch:gui')}')).Window.parent.dimensions()
  `), dimensions)
})

test('gui.Window.parent dimensions (set)', async ({ plan, teardown, alike }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
      `
    },
    teardown
  })
  const view = await ride.open()

  await view.visible()

  const parent = await ride.inspect('index.html', { decal: true })

  const child = await ride.inspect('extra.html', { decal: true })

  await child.visible()

  await child.run(`
    await (await import('${child.specifier('holepunch:gui')}')).Window.parent.dimensions({
      x: 100, y: 100, height: 100, width: 100
    })
  `)

  alike(await parent.dimensions(), { x: 100, y: 100, height: 100, width: 100 })
})

test('gui.Window.parent getMediaSourceId', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        await win.open()
        export const id = await gui.Window.self.getMediaSourceId()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const inspect = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  const { id } = await parent.exports('test.js')

  const parentId = await inspect.run(`
    const { Window } = await import('${inspect.specifier('holepunch://gui')}')
    await Window.parent.getMediaSourceId()
  `)

  is(id, parentId)
})

test('gui.Window on message / gui.Window.parent send', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        global.win = win
        let msg = null
        win.on('message', (message) => { msg = message })
        global.incomingMessage = new Promise((resolve) => {
          const interval = setInterval(() => {
            if (msg === null) return
            clearInterval(interval)
            resolve(msg)
          }, 100)
        })
        await win.open()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await child.run(`
    const { Window } = await import('${child.specifier('holepunch://gui')}')
    Window.parent.send('hello')
  `)

  is(await parent.run('await incomingMessage'), 'hello')
})

test('gui.Window.parent on message / gui.Window send', async ({ is, plan, teardown }) => {
  plan(1)
  const ride = await rider({
    show: true,
    app: './fixtures/template',
    vars: {
      test: `
        import gui from 'holepunch://gui'
        const win = new gui.Window('./extra.html')
        global.win = win
        await win.open()
      `
    },
    teardown
  })
  const parent = await ride.open()

  const child = await ride.inspect('extra.html')

  await parent.loaded('test.js')

  await child.run(`
    const { Window } = await import('${child.specifier('holepunch://gui')}')
    let msg = null
    Window.parent.on('message', (message) => { msg = message })
    global.incomingMessage = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (msg === null) return
        clearInterval(interval)
        resolve(msg)
      }, 100)
    })
  `)

  await parent.run('win.send(\'hello\')')
  is(await child.run('await incomingMessage'), 'hello')
})
