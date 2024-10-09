import Localdrive from 'localdrive'
import { fileURLToPath } from 'url-file-url'
import path from 'bare-path'

const drive = new Localdrive(path.join(fileURLToPath(import.meta.url), '../..'))

const prune = []
for await (const entry of drive.list('/')) {
  if (!entry.key.endsWith('.bare')) continue
  if (!(await drive.get(entry.key.replace(/\.bare$/, '.node')))) continue
  prune.push(entry.key)
}

for (const key of prune) {
  console.log('Pruning dual prebuild', key)
  await drive.del(key)
}
