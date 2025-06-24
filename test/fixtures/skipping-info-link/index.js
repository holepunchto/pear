const pipe = Pear.pipe

Pear.stage({ dir: '/path/to/dir' })

pipe.on('data', () => {
    try {
      pipe.write('pass')
    } catch (err) {
      console.error(err)
      Pear.exit()
    }
})
