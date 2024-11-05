'use strict'
import url from 'bare-url'
import path from 'bare-path'
import { spawn, spawnSync } from 'bare-subprocess'
import { RUNTIME } from '../constants'
import createTestnet from '@hyperswarm/testnet'
import fs from 'bare-fs'
import { isWindows } from 'which-runtime'

const filename = url.fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const root = path.dirname(dirname)

const force = Bare.argv.includes('--force-install')

const dirs = [
  path.join(root, 'test', 'fixtures', 'harness', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'require-assets', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'app-with-assets', 'node_modules')
]
for (const dir of dirs) {
  if (force === false && fs.existsSync(dir)) continue
  console.log(force ? 'reinstalling node_modules in' : 'node_modules not found in', path.dirname(dir))
  console.log('Running npm install...')
  if (isWindows) spawnSync('pwsh', ['-Command', 'npm install'], { cwd: path.dirname(dir), stdio: 'inherit' })
  else spawnSync('npm', ['install'], { cwd: path.dirname(dir), stdio: 'inherit' })
}

const testnet = await createTestnet(10)

const dhtBootstrap = testnet.nodes.map(e => `${e.host}:${e.port}`).join(',')

const logging = Bare.argv.filter((arg) => arg.startsWith('--log'))
const tests = spawn(RUNTIME, [...logging, 'run', '--dht-bootstrap', dhtBootstrap, '-t', 'test'], { cwd: root, stdio: 'inherit' })

tests.on('exit', async (code) => {
  await testnet.destroy()
  Bare.exitCode = code
})
