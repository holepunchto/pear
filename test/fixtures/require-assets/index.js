const fs = require('bare-fs')

const pipe = require('pear-pipe')()
pipe.on('data', () => {
  try {
    pipe.write(fs.readFileSync(require.asset('./text-file.txt')) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
