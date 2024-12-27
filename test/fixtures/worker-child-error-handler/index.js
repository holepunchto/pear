const pipe = Pear.worker.pipe()
pipe.on('error', (err) => {
  if (err.code === 'ENOTCONN') return
  throw err
})
pipe.write(`${Bare.pid}\n`)
