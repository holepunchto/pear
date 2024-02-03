import createPlatformDrive from './platform-drive.js'
import subsystem from './subsystem.js'

const drive = await createPlatformDrive()

// always start by booting the updater - thats alfa omega
const updater = await subsystem(drive, '/lib/updater.js')
await updater(drive)

// ensure the preload cjs scripts are ready
const gen = await subsystem(drive, '/lib/generate-preload.js')
const preload = await gen(drive)

console.log('preload script is', preload)

// and then boot the rest of the sidecar
const start = await subsystem(drive, '/lib/sidecar.js')
await start(drive)
