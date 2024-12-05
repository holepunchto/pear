const pipe = Pear.worker.pipe()
pipe.resume()
pipe.on('error', (err) => {
  if (err.code === 'ENOTCONN') return
  throw err
})
