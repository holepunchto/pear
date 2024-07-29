/* global Pear */
const { versions, config, updates, wakeups, Window } = Pear
console.log('link', config.link)
console.log('linkData', config.linkData)
console.log('key', config.key)

updates(function (data) {
  console.log('update available:', data)
})

wakeups(async (wakeup) => {
  console.log('GOT WAKEUP', wakeup)
  await Window.self.focus({ steal: true })
})

document.getElementById('channel').innerText = config.channel || 'none [ dev ]'
document.getElementById('release').innerText = config.release || (config.dev ? 'none [ dev ]' : '0')
const { app, platform } = await versions()
document.getElementById('platformKey').innerText = platform.key
document.getElementById('platformFork').innerText = platform.fork
document.getElementById('platformLength').innerText = platform.length
document.getElementById('appKey').innerText = app.key
document.getElementById('appFork').innerText = app.fork
document.getElementById('appLength').innerText = app.length

if (config.args.includes('--worker-demo')) {
  global.pipe = Pear.worker.run(config.links.worker)
  console.info('Pipe Duplex Stream available as `pipe`')
}

document.getElementById('reload').addEventListener('click', async () => {
  console.log('RELOAD!')
  await Pear.reload()
})

document.getElementById('platform-reload').addEventListener('click', async () => {
  console.log('PLATFORM RELOAD!')
  await Pear.reload({ platform: true })
})

document.getElementById('restart').addEventListener('click', async () => {
  console.log('RESTART!')
  await Pear.restart()
})

document.getElementById('platform-restart').addEventListener('click', async () => {
  console.log('PLATFORM RESTART!')
  await Pear.restart({ platform: true })
})
