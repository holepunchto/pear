'use strict'
import { fileURLToPath } from 'url-file-url'
import path from 'bare-path'
import { spawn, spawnSync } from 'bare-subprocess'
import createTestnet from '@hyperswarm/testnet'
import fs from 'bare-fs'
import env from 'bare-env'
import { isWindows } from 'which-runtime'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const root = path.dirname(dirname)

const { default: checkout } = await import('../checkout')
global.Pear = { constructor: { RTI: { checkout, mount: root } }, config: {} }

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
  console.log(
    force ? 'reinstalling node_modules in' : path.join(dir, 'node_modules') + ' not found'
  )
  console.log('Running npm install in ', dir)
  if (isWindows) {
    spawnSync('pwsh', ['-Command', 'npm install'], {
      cwd: dir,
      stdio: 'inherit'
    })
  } else {
    spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit' })
  }
}

const testnet = await createTestnet(10)
const dhtBootstrap = testnet.nodes.map((e) => `${e.host}:${e.port}`).join(',')

spawnSync(RUNTIME, ['sidecar', 'shutdown'], { stdio: 'inherit' })

const tests = spawn(
  isWindows ? 'npx.cmd' : 'npx',
  ['brittle-bare', '-j', '6', path.join('test', 'index.mjs'), ...Bare.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...env, PEAR_TEST_BOOTSTRAP: dhtBootstrap }
  }
)

tests.on('exit', async (code, signal) => {
  if (signal) code = 128 + signal
  await testnet.destroy()
  Bare.exitCode = code
})
