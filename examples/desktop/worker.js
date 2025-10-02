import pearPipe from 'pear-pipe'
const pipe = pearPipe()

pipe.on('data', (data) => {
    console.log('Data from parent:', data.toString())
    pipe.write('pong')
})
