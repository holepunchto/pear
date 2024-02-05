'use strict'
const os = require('bare-os')
const path = require('bare-path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Updater = class Updater { // todo, need new non-boot-drive pear-updater
  close () {}
  on () {}
}
const { decode } = require('hypercore-id-encoding')
const { IS_MAC, IS_WINDOWS } = require('../lib/constants')
const { print, Loading } = require('./iface')
const parse = require('../lib/parse')

module.exports = (ipc) => async function (args) {
  const { _: positionals } = parse.args(args)
  const [key] = positionals
  print('Switching release line to:\n  - [ ' + key + ' ]', 0)
  print('Closing any current Sidecar clients...', 0)
  const restarts = await ipc.closeClients()
  const n = restarts.length
  if (n > 0) print(`${n} client${n === 1 ? '' : 's'} closed`, true)
  print('Shutting down current Sidecar...', 0)
  await ipc.shutdown()

  print('Sidecar has shutdown', true)

  const loader = new Loading({ msg: 'Pʟᴇᴀsᴇ Sᴛᴀɴᴅ Bʏ…' })

  try {
    await use(key)
  } finally {
    await loader.clear()
    print('Release line switched to:\n  - [ ' + key + ' ]', true)
    Bare.exit()
  }
}

async function use (key = null, keyIndex = 3) {
  const PEAR_DIR = parse.arg('--platform-dir') || (IS_MAC
    ? path.join(os.homedir(), 'Library', 'Application Support', 'pear')
    : (IS_WINDOWS ? path.join(os.homedir(), 'AppData', 'Roaming', 'pear') : path.join(os.homedir(), '.config', 'pear')))
  const { additionalBuiltins } = require('../cli/pear')

  async function provision () {
    const KEY = decode(key || Bare.argv.slice(keyIndex).find(([c]) => c !== '-'))
    const store = path.join(PEAR_DIR, 'corestores', 'platform')
    const drive = new Hyperdrive(new Corestore(store), KEY)

    let onupdate = null
    const bootable = new Promise((resolve) => { onupdate = resolve })
    const updater = new Updater(drive, {
      additionalBuiltins,
      directory: PEAR_DIR,
      checkout: { key: KEY, length: 0, fork: 0 },
      onupdate (checkout) { onupdate(checkout) }
    })
    await drive.ready()
    const swarm = new Hyperswarm()
    swarm.on('connection', (connection) => drive.replicate(connection))
    swarm.join(drive.discoveryKey, { server: false, client: true })
    const checkout = await bootable // TODO: use u.bootable when available
    try {
      return checkout
    } finally {
      await drive.close()
      await updater.close()
      await swarm.destroy()
    }
  }

  return provision()
}
