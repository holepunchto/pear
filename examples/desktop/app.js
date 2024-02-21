/* global Pear */
const { versions, config, messages, Window } = Pear

console.log('link', config.link)
console.log('linkData', config.linkData)
console.log('key', config.key)

async function receiveWakeups () {
  for await (const msg of messages({ type: 'pear/wakeup' })) {
    console.log('GOT WAKEUP', msg)
    await Window.self.focus({ steal: true })
  }
}

receiveWakeups().catch(console.error)
document.getElementById('channel').innerText = config.channel || 'none [ dev ]'
document.getElementById('release').innerText = config.release || 'none [ dev ]'
const { app, platform } = await versions()
document.getElementById('platformKey').innerText = platform.key
document.getElementById('platformFork').innerText = platform.fork
document.getElementById('platformLength').innerText = platform.length
document.getElementById('appKey').innerText = app.key
document.getElementById('appFork').innerText = app.fork
document.getElementById('appLength').innerText = app.length

