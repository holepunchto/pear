'use strict'
import { fileURLToPath } from 'url-file-url'
import path from 'bare-path'
import { spawn, spawnSync } from 'bare-subprocess'
import createTestnet from '@hyperswarm/testnet'
import fs from 'bare-fs'
import { isWindows } from 'which-runtime'
const { default: checkout } = await import('../checkout')
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const root = path.dirname(dirname)
class API {
  static RTI = { checkout, mount: root }
  config = {}
}
global.Pear = new API()
const { RUNTIME } = await import('pear-api/constants')

const force = Bare.argv.includes('--force-install')

const dirs = [
  path.join(root, 'test', 'fixtures', 'require-assets', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'sub-dep-require-assets', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'teardown-after-exception', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'dht-bootstrap', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'encrypted', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'entrypoint-and-fragment', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'hello-world', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'print-args', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'require-assets', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'run-of-identify-unloading', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'storage', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'sub-dep-require-assets', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'teardown', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'teardown-exit-code', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'teardown-os-kill', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'unloading', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'unresponsive', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'updates', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'versions', 'node_modules')
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
spawnSync(RUNTIME, ['sidecar', 'shutdown'], { stdio: 'inherit' })
const tests = spawn(RUNTIME, [...logging, 'run', '--dht-bootstrap', dhtBootstrap, 'test'], { cwd: root, stdio: 'inherit' })

tests.on('exit', async (code) => {
  await testnet.destroy()
  Bare.exitCode = code
})
