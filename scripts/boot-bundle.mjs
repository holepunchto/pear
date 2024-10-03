#!/usr/bin/env bare
import Bundle from 'bare-bundle'
import Localdrive from 'localdrive'
import DriveBundler from 'drive-bundler'
import fs from 'bare-fs'

const dirname = new URL('..', import.meta.url).pathname

const drive = new Localdrive(dirname)
const b = new Bundle()

const cache = {}
const res = {}

const { entrypoint, resolutions, sources } = await DriveBundler.bundle(drive, { cache, cwd: dirname, entrypoint: '/boot.js', absoluteFiles: false })

for (const [key, map] of Object.entries(resolutions)) {
  res[key] = map
}

for (const [key, source] of Object.entries(sources)) {
  cache[key] = true
  b.write(key, source)
}

b.main = entrypoint
b.resolutions = res

fs.writeFileSync(dirname + 'boot.bundle', b.toBuffer())
