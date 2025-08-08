'use strict'
const ipc = Pear[Pear.constructor.IPC]
ipc.identify({ startId: Pear.config.query }) // register as second client
Pear.pipe.write('unwind')
Pear[Pear.constructor.IPC].unloading().then(() => {
  Pear.pipe.write('unloading', () => { 
    Pear.exit()
  })
})