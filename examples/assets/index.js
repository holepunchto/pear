const fs = require('bare-fs')
const filename = require.asset('./index.js')
console.log('filename:', filename)
fs.promises.readFile(filename, 'utf-8').then((file) => console.log(file))
