#!/usr/bin/env bare
import Bundle from 'bare-bundle'
import Localdrive from 'localdrive'
import DriveBundler from 'drive-bundler'
import fs from 'bare-fs'

const dirname = new URL('..', import.meta.url).pathname

const drive = new Localdrive(dirname)
const b = new Bundle()

const { entrypoint, resolutions, sources } = await DriveBundler.bundle(drive, { cache: null, cwd: dirname, entrypoint: '/boot.js', absolutePrebuilds: false })

b.main = entrypoint
b.resolutions = resolutions

for (const [key, source] of Object.entries(sources)) {
  b.write(key, source)
}

fs.writeFileSync(dirname + 'boot.bundle', b.toBuffer())
console.log('Done!')
