'use strict'
import path from 'bare-path'
import { spawn } from 'bare-subprocess'
import { isWindows } from 'which-runtime'
import { RUNTIME } from '../constants'
import createTestnet from '@hyperswarm/testnet'

const { pathname } = new URL(global.Pear.config.applink)
const cwd = isWindows ? path.normalize(pathname.slice(1)) : pathname
const testnet = await createTestnet(10)

const bootstrap = testnet.nodes.map(e => `${e.host}:${e.port}`).join(',')

const tests = spawn(RUNTIME, ['run', '--bootstrap', bootstrap, '-t', 'test', ...global.Pear.config.args], { cwd, stdio: 'inherit' })

tests.on('exit', async (code) => {
  await testnet.destroy()
  Bare.exitCode = code
})
