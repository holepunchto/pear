Pear.pipe.on('data', () => Pear.pipe.write(`${Bare.pid}\n`))
const resource = setTimeout(() => {}, Number.MAX_SAFE_INTEGER)
Pear[Pear.constructor.IPC].unloading().then(() => {
  clearTimeout(resource)
})