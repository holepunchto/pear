/* global Pear */
import ReadyResource from 'ready-resource'
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'

class Harness extends ReadyResource {
  inspector = null
  inspectorKey = null
  cmd = null
  Helper = null
  API = null
  ipc = null
  sub = null
  async _open () {
    this.inspector = new Inspector({ inspector: bareInspector })
    this.key = await this.inspector.enable()
    this.inspectorKey = this.key.toString('hex')
    console.log(`{ "tag": "inspector", "data": { "key": "${this.inspectorKey}" }}`)
  }

  async _close () {
    await this.inspector.disable()
    await this.sub?.destroy()
    if (this._client) await this._client.close()
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

  async command (argv) {
    if (this.closed) throw new Error('Harness closed')
    this._client = await this.client()
    return this.cmd(this._client, argv)
  }
}
const harness = new Harness()
Pear.teardown(() => harness.close())
await harness.ready()
global.__PEAR_TEST__ = harness
