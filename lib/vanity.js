const Worker = require('bare-worker')
const crypto = require('hypercore-crypto')
const Hypercore = require('hypercore')
const z32 = require('z32')
const os = require('os')

if (!Worker.isMainThread) runWorker()

function toHex(buf) {
  return Buffer.from(buf).toString('hex')
}

module.exports = function findVanityKey(start) {
  const workers = (os.cpus() && os.cpus().length) || 1

  return new Promise((resolve, reject) => {
    const runningWorkers = new Set()
    let finished = false

    const stopAll = () => {
      for (const worker of runningWorkers) {
        try {
          worker.terminate()
        } catch {}
      }
    }

    const done = (err, result) => {
      if (finished) return
      finished = true
      stopAll()
      if (err) reject(err)
      else resolve(result)
    }

    for (let i = 0; i < workers; i++) {
      const worker = new Worker(__filename, {
        workerData: { target: start }
      })

      runningWorkers.add(worker)

      worker.on('message', (data) => {
        done(null, { ...data, workers })
      })

      worker.on('error', (err) => {
        done(err)
      })

      worker.on('exit', (code) => {
        runningWorkers.delete(worker)
        if (finished) return
        if (code !== 0) done(new Error(`Worker exited with code ${code}`))
      })
    }
  })
}

function runWorker() {
  const target = Worker.workerData && Worker.workerData.target

  let attempts = 0
  while (true) {
    attempts++
    const keyPair = crypto.keyPair()
    const z = z32.encode(Hypercore.key({ signers: [{ publicKey: keyPair.publicKey }] }))

    if (z.startsWith(target)) {
      Worker.parentPort.postMessage({
        z,
        publicKey: toHex(keyPair.publicKey),
        secretKey: toHex(keyPair.secretKey),
        attempts
      })
      return
    }
  }
}
