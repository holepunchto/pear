const pipeIn = Pear.worker.pipe()
pipeIn.write(`${Bare.pid}`)

const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.run(link)
const pid = await new Promise((resolve) => {
  pipe.on('data', (data) => resolve(data.toString()))
})
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.destroy()
await untilWorkerExit(pid)
pipeIn.end()

async function untilWorkerExit (pid, timeout = 5000) {
  if (!pid) throw new Error('Invalid pid')
  const start = Date.now()
  while (isRunning(pid)) {
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
