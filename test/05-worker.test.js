'use strict'
/* global Pear */
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const worker = path.join(Helper.root, 'test', 'fixtures', 'worker')

test('worker pipe', async function ({ is, plan, comment, teardown }) {
  plan(1)
  const stager = new Helper()
  teardown(() => stager.close())
  await stager.ready()
  const dir = worker

  const pipe = Pear.worker.run(dir)

  const messages = []
  const response = new Promise((resolve) => {
    pipe.on('data', (data) => {
      messages.push(data.toString())
      if (messages.length === 4) resolve(messages.join(''))
    })
  })

  pipe.write('ping')

  const workerResponse = await response
  is(workerResponse, '0123', 'worker pipe can send and receive data')

  pipe.write('exit')
})
