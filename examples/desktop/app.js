/* global Pear */
const { versions, config, updates, wakeup, Window } = Pear

console.log('link', config.link)
console.log('linkData', config.linkData)
console.log('key', config.key)

updates(function (data) {
  console.log('update available:', data)
})

wakeup(async (wakeup) => {
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
