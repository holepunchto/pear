/* global Pear */
import os from 'bare-os'
import inspector from 'bare-inspector'
import ReadyResource from 'ready-resource'
import { Inspector } from 'pear-inspect'
const CWD = os.cwd()
class Harness extends ReadyResource {
  inspector = null
  inspectorKey = null
  cmd = null
  Helper = null
  API = null
  ipc = null
  sub = null
  async _open () {
    this.inspector = new Inspector({ inspector })
    this.key = await this.inspector.enable()
    this.inspectorKey = this.key.toString('hex')
    console.log(`{ "tag": "inspector", "data": { "key": "${this.inspectorKey}" }}`)
  }

  async close () {
    await this.inspector.disable()
    await this.sub?.destroy()
    this.inspector = null
    this.sub = null
    this.key = null
    this.inspectorKey = null
    this.Helper = null
    this.cmd = null
    this.API = null
    this.ipc = null
  }

  async client (opts) {
    if (this.Helper === null) {
      const { default: Helper } = await import('pear/test/helper')
      this.Helper = Helper
    }
    if (this.cmd === null) {
      const { default: cmd } = await import('pear/cmd')
      this.cmd = cmd
    }
    return new this.Helper(opts)
  }

  nextUpdate () {
    if (this.sub === null) this.sub = Pear.updates()
    return new Promise((resolve) => {
      this.sub.once('data', resolve)
    })
  }

  async command (argv, cwd = os.cwd()) {
    if (this.closed) throw new Error('Harness closed')
    const ipc = await this.client()
    if (cwd !== os.cwd()) os.chdir(cwd)
    try {
      return await this.cmd(ipc, argv)
    } finally {
      os.chdir(CWD)
    }
  }
}
const harness = new Harness()
Pear.teardown(() => harness.close())
await harness.ready()
global.__PEAR_TEST__ = harness
