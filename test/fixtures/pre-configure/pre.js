const cenc = require('compact-encoding')
const pipe = require('pear-pipe')()

pipe?.on('end', () => Pear.pipe.end())
pipe?.once('data', (data) => {
    const options = cenc.decode(cenc.any, data)

    options.name = 'pre-success'

    const buffer = cenc.encode(cenc.any, { tag: 'configure', data: options })
    pipe.end(buffer)
})
