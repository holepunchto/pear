Pear.constructor.CUTOVER = false

const pipe = require('pear-pipe')()

let updates
pipe.on('data', (data) => {
  if (data.toString().trim() === 'start-listener') updates = Pear.updates((data) => {
    pipe.write(JSON.stringify(data) + '\n')
  })
})

pipe.on('end', () => updates?.end?.())
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
