const pipe = require('pear-pipe')()

const updates = Pear.updates((data) => {
  pipe.write(JSON.stringify(data) + '\n')
})

pipe.on('end', () => updates.end())
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
