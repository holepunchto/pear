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
const { RUNTIME } = await import('pear-constants')

const force = Bare.argv.includes('--force-install')
const fixtures = path.join(root, 'test', 'fixtures')
const dirs = fs.readdirSync(fixtures).map((name) => path.join(fixtures, name))

for (const dir of dirs) {
  if (force === false && fs.existsSync(path.join(dir, 'node_modules'))) continue
  const pkg = path.join(dir, 'package.json')
  if (fs.existsSync(pkg) === false) continue
  const { dependencies = {} } = await import(pkg)
  if (Object.keys(dependencies).length === 0) continue
  console.log(force ? 'reinstalling node_modules in' : path.join(dir, 'node_modules') + ' not found')
  console.log('Running npm install in ', dir)
  if (isWindows) spawnSync('pwsh', ['-Command', 'npm install'], { cwd: dir, stdio: 'inherit' })
  else spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit' })
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
