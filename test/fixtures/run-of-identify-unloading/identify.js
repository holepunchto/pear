'use strict'
const ipc = Pear[Pear.constructor.IPC]
ipc.identify({ startId: Pear.app.query }) // register as second client
const pipe = require('pear-pipe')()
pipe.write('unwind')
Pear[Pear.constructor.IPC].unloading().then(() => {
  pipe.write('unloading', () => { 
    Pear.exit()
  })
})