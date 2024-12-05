const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.run(link)
pipe.resume()
pipe.on('error', (err) => {
  if (err.code === 'ENOTCONN') return
  throw err
})
await untilExit(pipe)
Pear.worker.pipe().end()

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
