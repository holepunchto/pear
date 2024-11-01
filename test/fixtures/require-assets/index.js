const fsp = require('bare-fs/promises')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  fsp.readFile(require.asset('./text-file.txt')).then((text) => {
    pipe.write(text)
  }).catch((err) => {
    console.error(err)
    pipe.write('failed to read asset')
  })
})
