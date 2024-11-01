const fs = require('bare-fs')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write(fs.readFileSync(require.asset('./text-file.txt'), 'utf8'))
  } catch (err) {
    console.error(err)
    pipe.write('failed to read asset')
  }
})
