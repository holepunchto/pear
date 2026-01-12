const pipe = require('pear-pipe')()
const updates = require('pear-updates')
const stream = updates((data) => {
  pipe.write(JSON.stringify(data) + '\n')
})

pipe.on('end', () => stream.end())
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
