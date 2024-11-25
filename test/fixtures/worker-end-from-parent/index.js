const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.run(link)
pipe.resume()
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.end()
await untilExit(pipe)

async function untilExit (pipe, timeout = 5000) {
  const start = Date.now()
  while (isRunning(pipe)) {
    if (Date.now() - start > timeout) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

function isRunning (pipe) {
  try {
    return process.kill(pipe.pid, 0)
  } catch (err) {
    return err.code === 'EPERM'
  }
}
