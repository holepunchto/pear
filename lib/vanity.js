const Channel = require('bare-channel')
const crypto = require('hypercore-crypto')
const Hypercore = require('hypercore')
const z32 = require('z32')
const os = require('bare-os')

if (!Bare.Thread.isMainThread && Bare.Thread.self.data._vanityThread) runThread()

module.exports = function findVanityKey(start) {
  const numThreads = os.availableParallelism() || 1

  return new Promise((resolve) => {
    const runningThreads = []
    let finished = false

    const stopAll = () => {
      for (const thread of runningThreads) {
        try {
          thread.terminate()
        } catch {}
      }
    }

    for (let i = 0; i < numThreads; i++) {
      if (finished) continue
      const channel = new Channel()
      const connection = channel.connect()

      runningThreads.push(
        new Bare.Thread(__filename, {
          data: { _vanityThread: true, handle: channel.handle, target: start }
        })
      )

      const readStream = connection.createReadStream()
      readStream.once('data', (data) => {
        if (finished) return
        finished = true
        stopAll()
        resolve(data)
      })
    }
  })
}

async function runThread() {
  const { handle, target } = Bare.Thread.self.data

  const channel = Channel.from(handle)
  const connection = channel.connect()

  let attempts = 0
  while (true) {
    attempts++

    // Allow thread to handle thread termination
    if (attempts % 1000 === 0) await new Promise((resolve) => setImmediate(resolve))

    const keyPair = crypto.keyPair()
    const z = z32.encode(Hypercore.key({ signers: [{ publicKey: keyPair.publicKey }] }))

    if (z.startsWith(target)) {
      await connection.write(keyPair)
      return
    }
  }
}
