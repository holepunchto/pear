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
    this._client = null
    console.log(`{ "tag": "inspector", "data": { "key": "${this.inspectorKey}" }}`)
  }

  async _close () {
    await this.inspector?.disable()
    await this.sub?.destroy()
    await this._client?.close()
    this.inspector = null
    this.sub = null
    this.key = null
    this.inspectorKey = null
    this.Helper = null
    this.cmd = null
    this.API = null
    this.ipc = null
    this._client = null
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
    this._client = new this.Helper(opts)
    return this._client
  }

  nextUpdate () {
    if (this.sub === null) this.sub = Pear.updates()
    return new Promise((resolve) => {
      this.sub.once('data', resolve)
    })
  }

  async command (argv) {
    if (this.closed) throw new Error('Harness closed')
    const ipc = await this.client()
    return this.cmd(ipc, argv)
  }
}
const harness = new Harness()
console.log('setup teardown')
Pear.teardown(() => {
  console.log('teardown occurs')
  harness.close()
  Bare.exit()
})
await harness.ready()
global.__PEAR_TEST__ = harness
