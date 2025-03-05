const pipe = Pear.pipe
pipe.on('error', (err) => {
  if (err.code === 'ENOTCONN') return
  throw err
})
pipe.write(`${Bare.pid}\n`)
