const pipe = require('pear-pipe')()
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify(Bare.versions) + '\n')
  } catch (err) {
    console.error(err)
    Bare.exit()
  }
})
