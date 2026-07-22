'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const plink = require('pear-link')
const constants = require('../constants')
const context = require('../context')
const GC = require('../subsystems/sidecar/ops/gc')

constants.init('dev', false)

const gc = require('../cmd/gc')

const command = (link) => ({
  command: {
    name: 'cores',
    args: { link },
    parent: { flags: { json: false } }
  }
})

test('pear gc cores with link', async ({ is, plan, teardown, tmp }) => {
  plan(6)

  const source = new Corestore(await tmp())
  const destination = new Corestore(await tmp())
  teardown(() => source.close())
  teardown(() => destination.close())
  await source.ready()
  await destination.ready()

  const target = new Hyperdrive(source.namespace('target'))
  const other = new Hyperdrive(source.namespace('other'))
  await target.ready()
  await other.ready()
  await target.put('/target', Buffer.from('target'))
  await other.put('/other', Buffer.from('other'))

  const targetClone = new Hyperdrive(destination.session(), target.key)
  const otherClone = new Hyperdrive(destination.session(), other.key)
  const sourceReplication = source.replicate(true)
  const destinationReplication = destination.replicate(false)
  sourceReplication.pipe(destinationReplication).pipe(sourceReplication)

  await targetClone.ready()
  await otherClone.ready()
  await targetClone.download().done()
  await otherClone.download().done()

  const targetDiscoveryKeys = [targetClone.core.discoveryKey, targetClone.blobs.core.discoveryKey]
  const otherDiscoveryKeys = [otherClone.core.discoveryKey, otherClone.blobs.core.discoveryKey]

  await targetClone.close()
  await otherClone.close()
  sourceReplication.destroy()
  destinationReplication.destroy()

  const sidecar = {
    corestore: destination,
    getCorestore() {
      return destination.session()
    }
  }
  const link = plink.serialize({ drive: { key: target.key } })
  const stream = new GC({ resource: 'cores', data: { link } }, null, sidecar, {
    autosession: false
  })

  let removed = 0
  let success = false
  for await (const message of stream) {
    if (message.tag === 'remove') removed++
    if (message.tag === 'final') success = message.data.success
  }

  is(removed, 2)
  is(success, true)
  is(await hasAllBlocks(destination, targetDiscoveryKeys[0]), false)
  is(await hasAllBlocks(destination, targetDiscoveryKeys[1]), false)
  is(await hasAllBlocks(destination, otherDiscoveryKeys[0]), true)
  is(await hasAllBlocks(destination, otherDiscoveryKeys[1]), true)
})

test('pear gc cores without link', async ({ is, exception, plan, teardown }) => {
  plan(2)

  const previous = context.getIPC()
  teardown(() => context.setIPC(previous))

  let called = false
  context.setIPC({
    gc() {
      called = true
      return []
    }
  })

  await exception(() => gc(command()), /A link must be specified/)
  is(called, false)
})

async function hasAllBlocks(store, discoveryKey) {
  const info = await store.storage.getInfo(discoveryKey)
  const core = store.get({ discoveryKey: info.discoveryKey, active: false })
  await core.ready()
  const has = await core.has(0, core.length)
  await core.close()
  return has
}
