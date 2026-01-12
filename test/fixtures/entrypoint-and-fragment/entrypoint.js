const pipe = require('pear-pipe')()
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify({ entrypoint: Pear.app.entrypoint, fragment: Pear.app.fragment }) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
