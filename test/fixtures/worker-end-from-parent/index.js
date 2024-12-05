const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.run(link)
pipe.resume()
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.end()
await untilWorkerExit(pipe)
Pear.worker.pipe().end() // TODO: v2 -> Pear.pipe.end()

async function untilWorkerExit (pipe, timeout = 5000) {
  const start = Date.now()
  while (isRunning(pipe.pid)) {
    if (Date.now() - start > timeout) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

function isRunning (pid) {
  try {
    // 0 is a signal that doesn't kill the process, just checks if it's running
    return process.kill(pid, 0)
  } catch (err) {
    return err.code === 'EPERM'
  }
}
