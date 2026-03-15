const Corestore = require('corestore')
const Rache = require('rache')
const Hyperdrive = require('hyperdrive')
const plink = require('pear-link')
const path = require('bare-path')
const { randomBytes } = require('hypercore-crypto')
const MirrorDrive = require('mirror-drive')
const LocalDrive = require('localdrive')
const fs = require('bare-fs')
const test = require('brittle')

test('stage corruption', async function (t) {
  const globalCache = new Rache({ maxSize: 65536 })
  const platformCorestore = new Corestore(await t.tmp(), {
    globalCache,
    manifestVersion: 1,
    compat: false,
    wait: true
  })
  await platformCorestore.ready()

  // touch
  let link
  {
    const name = '!touch'
    const namespace = randomBytes(16).toString('hex')
    const corestore = platformCorestore.namespace(`${name}~${namespace}`, { writable: false })
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    link = plink.serialize({ protocol: 'pear:', drive: { key } })
    console.log('link is', link)
  }

  const parsed = plink.parse(link)
  const key = parsed.drive.key

  // stage
  try {
    const dir = path.join(__dirname, 'fixtures', 'stage-app-min-with-entrypoints')
    const corestore = platformCorestore.session({ writable: true })
    await corestore.ready()

    const drive = new Hyperdrive(corestore, key, { encryptionKey: null, _id: 'main' })
    const db = drive.db
    await drive.ready()

    console.log('current length is', drive.core.length)
    console.log(await db.get('manifest'))

    await db.put('manifest', 'hello world')
    const src = new LocalDrive(dir, {
      followExternalLinks: true,
      metadata: new Map()
    })

    const mirror = new MirrorDrive(src, drive, { dedup: true, batch: true })
    let mirrorCount = 0
    for await (const diff of mirror) {
      // close the drive on the 2nd file
      if (mirrorCount++ === 2) setImmediate(async () => await drive.close())
    }
  } catch (e) {
    console.log('err', e)
  }

  {
    const corestore = platformCorestore.session({ writable: true })
    await corestore.ready()

    const drive = new Hyperdrive(corestore, key, { encryptionKey: null, _id: 'main' })
    await drive.ready()
    const db = drive.db

    t.comment('current length is', drive.core.length)
    t.ok(await db.get('manifest'))
  }
})
