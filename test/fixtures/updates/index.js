const updates = require('pear-updates')
const pipe = require('pear-pipe')()

updates((data) => {
  pipe.write(JSON.stringify(data) + '\n')
})

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions) + '\n'))
