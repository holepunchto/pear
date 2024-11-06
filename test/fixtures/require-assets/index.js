const fs = require('bare-fs')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write(fs.readFileSync(require.asset('./text-file.txt')))
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
