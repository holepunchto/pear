'use strict'
const hid = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const { ERR_OPERATION_FAILED } = require('pear-errors')
const BlindPeering = require('blind-peering')

function createClient(dht, corestore, peerKey) {
  const blindPeerKey = hid.decode(peerKey)
  return new BlindPeering(dht, corestore, {
    keys: [blindPeerKey],
    pick: 1
  })
}

async function addCore(client, core, { announce, peerKey, timeout = 30000 } = {}) {
  const { promise, reject } = Promise.withResolvers()
  let timer = null

  timer = setTimeout(() => {
    reject(new ERR_OPERATION_FAILED(`Timed out connecting to blind peer ${peerKey} to connect`))
  }, timeout)
  timer.unref()

  try {
    await Promise.race([client.addCore(core, { announce }), promise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function untilBlobs(drive, swarm) {
  if (drive.blobs) return Promise.resolve()

  const { promise, resolve, reject } = Promise.withResolvers()
  const discovery = swarm.join(drive.discoveryKey, {
    server: false,
    client: true
  })

  const cleanup = () => {
    drive.off('blobs', onBlobs)
    discovery.destroy().catch(safetyCatch)
  }

  const onBlobs = () => {
    cleanup()
    resolve()
  }

  drive.once('blobs', onBlobs)
  drive.getBlobs().catch((err) => {
    cleanup()
    reject(err)
  })

  return promise
}

function untilConnected(core, peerKey, { timeout = 15000, teardown } = {}) {
  const normalizedPeerKey = hid.normalize(peerKey)
  if (core.peers.some((peer) => hid.normalize(peer.remotePublicKey) === normalizedPeerKey)) {
    return Promise.resolve()
  }

  const { promise, resolve, reject } = Promise.withResolvers()
  let timer = null
  let done = false

  const cleanup = () => {
    if (done) return
    done = true
    if (timer) clearTimeout(timer)
    core.off('peer-add', onPeerAdd)
    core.off('close', onClose)
  }

  const onPeerAdd = (peer) => {
    if (hid.normalize(peer.remotePublicKey) === normalizedPeerKey) {
      cleanup()
      resolve()
    }
  }

  const onClose = () => {
    if (done) return
    cleanup()
    reject(new ERR_OPERATION_FAILED('Core was closed before blind peer connected'))
  }

  const onTeardown = () => {
    if (done) return
    cleanup()
    reject(new ERR_OPERATION_FAILED('Session was closed before blind peer connected'))
  }

  timer = setTimeout(() => {
    if (done) return
    cleanup()
    reject(new ERR_OPERATION_FAILED(`Timed out waiting for blind peer ${normalizedPeerKey}`))
  }, timeout)
  timer.unref()

  core.on('peer-add', onPeerAdd)
  core.on('close', onClose)
  if (teardown) teardown(onTeardown)

  return promise
}

async function requestCores(
  client,
  cores,
  {
    peerKey,
    announce = true,
    timeout = 30000,
    onAddingCore,
    onConfirmingCore,
    onAddedCore,
    teardown
  } = {}
) {
  const normalizedPeerKey = hid.normalize(peerKey)
  await Promise.all(
    cores.map(async (core) => {
      const subCoreKey = hid.normalize(core.key)
      LOG.info('blind-peer-request', `Requesting core ${subCoreKey} to be added`)
      if (onAddingCore) onAddingCore({ key: subCoreKey, peerKey: normalizedPeerKey, announce })
      await addCore(client, core, {
        announce,
        peerKey: normalizedPeerKey,
        timeout
      })

      if (onConfirmingCore) onConfirmingCore({ key: subCoreKey, peerKey: normalizedPeerKey })

      await untilConnected(core, peerKey, { timeout, teardown })
      LOG.info('blind-peer-request', `Successfully added core ${subCoreKey}`)
      if (onAddedCore) onAddedCore({ key: subCoreKey, peerKey: normalizedPeerKey })
    })
  )
}

module.exports = {
  createClient,
  addCore,
  untilBlobs,
  untilConnected,
  requestCores
}
