const appling = require('appling-native')

async function preflight(id, dir) {
  const lock = await appling.lock(dir)

  let platform
  try {
    platform = await appling.resolve(dir)
  } catch {
    return lock
  }

  if (platform.ready(`pear://${id}`) === false) return lock

  await lock.unlock()

  platform.launch(id)

  Bare.exit()
}

module.exports = { preflight }
