const Worker = require('bare-worker')
const crypto = require('hypercore-crypto')
const Hypercore = require('hypercore')
const z32 = require('z32')
const os = require('bare-os')

if (!Worker.isMainThread && Worker.workerData && Worker.workerData._vanityWorker) runWorker()

module.exports = function findVanityKey(start) {
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

      const worker = new Worker(__filename, { workerData: { _vanityWorker: true, target: start } })
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

async function runWorker() {
  const target = Worker.workerData && Worker.workerData.target

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
