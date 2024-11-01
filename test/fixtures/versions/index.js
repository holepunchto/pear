const pipe = Pear.worker.pipe()
pipe.on('data', async () => pipe.write(JSON.stringify(await Pear.versions())))
