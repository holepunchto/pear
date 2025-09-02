import pearUpdates from 'pear-updates'
const pipe = require('pear-pipe')()

const updates = pearUpdates((data) => {
  pipe.write(JSON.stringify(data) + '\n')
})

pipe.on('end', () => updates.end())
pipe.resume()

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
