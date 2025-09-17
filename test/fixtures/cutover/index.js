Pear.constructor.CUTOVER = false

const pipe = require('pear-pipe')()

let id = 0
let updates = []
pipe.on('data', (data) => {
  if (data.toString().trim() === 'start-listener') {
    const listenerId = ++id
    updates.push(Pear.updates((data) => {
      pipe.write(JSON.stringify({ id: listenerId, data }) + '\n')
    }))
  }
})

pipe.on('end', () => updates.forEach(u => u?.end?.()))
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
