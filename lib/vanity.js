const Worker = require('bare-worker')
const crypto = require('hypercore-crypto')
const Hypercore = require('hypercore')
const z32 = require('z32')
const os = require('bare-os')
const HyperMultisig = require('hyper-multisig')
const hid = require('hypercore-id-encoding')

if (!Worker.isMainThread && Worker.workerData && Worker.workerData._vanityWorker) runWorker()

module.exports = function findVanityKey(start, type = 'touch', config = undefined) {
  const workers = os.availableParallelism() || 1

  return new Promise((resolve) => {
    const runningWorkers = []
    let finished = false

    const stopAll = () => {
      for (const worker of runningWorkers) {
        try {
          worker.terminate()
        } catch {}
      }
    }

    for (let i = 0; i < workers; i++) {
      if (finished) continue

      const worker = new Worker(__filename, {
        workerData: { _vanityWorker: true, target: start, type, config }
      })
      runningWorkers.push(worker)

      worker.once('message', (data) => {
        if (finished) return
        finished = true
        stopAll()
        resolve(data)
      })
    }
  })
}

async function multisigVanity(target, config) {
  const { publicKeys, namespace, quorum } = config

  const namespaceBase = namespace.includes('$')
    ? namespace.split('$').slice(0, -1).join('$')
    : namespace

  let attempts = 0
  while (true) {
    attempts++

    // Yield to events to allow worker to handle termination
    if (attempts % 1000 === 0) await new Promise((resolve) => setImmediate(resolve))

    const newNamespace =
      attempts > 1 ? `${namespaceBase}$${z32.encode(crypto.randomBytes(32))}` : namespace
    const key = HyperMultisig.getCoreKey(publicKeys, newNamespace, { quorum })

    const z = hid.normalize(key)

    if (z.startsWith(target)) {
      Worker.parentPort.postMessage(newNamespace)
      return
    }
  }
}

async function touchVanity(target) {
  let attempts = 0
  while (true) {
    attempts++

    // Yield to events to allow worker to handle termination
    if (attempts % 1000 === 0) await new Promise((resolve) => setImmediate(resolve))

    const keyPair = crypto.keyPair()
    const z = z32.encode(Hypercore.key({ signers: [{ publicKey: keyPair.publicKey }] }))

    if (z.startsWith(target)) {
      Worker.parentPort.postMessage(keyPair)
      return
    }
  }
}

async function runWorker() {
  if (!Worker.workerData) return
  const { target, type, config } = Worker.workerData

  if (type === 'multisig') await multisigVanity(target, config)
  if (type === 'touch') await touchVanity(target)
}
