/** @typedef {import('pear-interface')} */ /* global Pear, document */
import ui from 'pear-electron'
import pearPipe from 'pear-pipe'
import updates from 'pear-updates'
import wakeups from 'pear-wakeups'

console.log('link', Pear.config.link)
console.log('linkData', Pear.config.linkData)
console.log('key', Pear.config.key)
const pipe = pearPipe()
pipe.on('data', (data) => {
  const cmd = Buffer.from(data).toString()
  if (cmd === 'hello from app') pipe.write('hello from ui')
  console.log('PIPE DATA', cmd)
})

updates((update) => {
  console.log('update available:', update)
  document.getElementById('update').style.display = 'revert'
  const action = document.getElementById('action')
  action.style.display = 'revert'
  action.onclick = () => { Pear.restart({ platform: !update.app }) }
  action.innerText = 'Restart ' + (update.app ? 'App' : 'Pear') + ' [' + update.version.fork + '.' + update.version.length + ']'
})

wakeups(async (wakeup) => {
  console.log('GOT WAKEUP', wakeup)
  await ui.app.focus({ steal: true })
})

Pear.teardown(async () => {
  console.log('Perform async teardown here')
  await new Promise((resolve) => setTimeout(resolve, 500)) // example async work
})

document.getElementById('link').innerText = Pear.app.link || 'none'
document.getElementById('release').innerText = Pear.app.release || (Pear.app.dev ? 'none [ dev ]' : '0')
const { app, platform } = await Pear.versions()
document.getElementById('platformKey').innerText = platform.key
document.getElementById('platformFork').innerText = platform.fork
document.getElementById('platformLength').innerText = platform.length
document.getElementById('appKey').innerText = app.key
document.getElementById('appFork').innerText = app.fork
document.getElementById('appLength').innerText = app.length
