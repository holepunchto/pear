const pipe = require('pear-pipe')()
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify(Pear.app.args) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
