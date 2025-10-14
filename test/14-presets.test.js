'use strict'
const test = require('brittle')
const Helper = require('./helper')

t('set preset and get preset', async (t) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

})
