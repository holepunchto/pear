/* global Pear */
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'

const { teardown } = Pear

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

console.log(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

global.__PEAR_TEST__ = new class __PEAR_TEST__ {
  inspector = inspector
  inspectorKey = inspectorKey
  cmd = null
  Helper = null
  API = null
  ipc = null
  sub = null
  async command (argv) {
    if (this.Helper === null) {
      const { default: Helper } = await import('pear/test/helper')
      this.Helper = Helper
    }
    if (this.cmd === null) {
      const { default: cmd } = await import('pear/cmd')
      this.cmd = cmd
    }
    if (this.API === null) {
      const { default: API } = await import('pear/lib/api')
      this.API = API
    }
    if (this.ipc === null) this.ipc = new this.Helper()

    return this.cmd(this.ipc, argv)
  }
}()

teardown(async () => await inspector.disable())
