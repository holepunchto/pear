Pear.constructor.CUTOVER = !Bare.argv.includes('--no-cutover')
const updates = require('pear-updates')
const pipe = require('pear-pipe')()

let id = 0
const info = []
pipe.on('data', (data) => {
  if (data.toString().trim() === 'start-listener') {
    const listenerId = ++id
    info.push(updates((data) => {
      pipe.write(JSON.stringify({ id: listenerId, data }) + '\n')
    }))
  }
})

pipe.on('end', () => info.forEach((u) => u?.end?.()))
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
