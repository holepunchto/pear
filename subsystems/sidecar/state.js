'use strict'
const path = require('bare-path')
const fsp = require('bare-fs/promises')
const sameData = require('same-data')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_PROJECT_DIR, ERR_INVALID_MANIFEST } = require('pear-errors')
const SharedState = require('pear-state')

module.exports = class State extends SharedState {
  constructor(opts) {
    super(opts)
    this.reconfigure()
  }

  reconfigure() {
    this.config = this.constructor.configFrom(this)
  }

  update(state) {
    Object.assign(this, state)
    this.reconfigure()
  }

  async initialize({ pod, app, dryRun = false, pkg = null } = {}) {
    if (app?.reported) return
    await pod.ready()
    if (app?.reported) return
    this.applink = pod.link

    if (this.key !== null) {
      if (pod.drive.core.length === 0) {
        await pod.drive.core.update()
        if (app?.reported) return
      }
      const result = await pod.db.get('manifest')
      if (app?.reported) return
      if (result === null) {
        throw ERR_INVALID_MANIFEST(
          `unable to fetch manifest from app pear://${hypercoreid.encode(this.key)}`
        )
      }
      if (result.value === null) {
        throw ERR_INVALID_MANIFEST(
          `empty manifest found from app pear://${hypercoreid.encode(this.key)}`
        )
      }
      await this.constructor.build(this, result.value)
      if (app?.reported) return
    } else {
      await this.constructor.build(this, pkg)
      if (app?.reported) return

      if (this.stage && dryRun === false && this.manifest) {
        const result = await pod.db.get('manifest')
        if (app?.reported) return
        if (!result || !sameData(result.value, this.manifest)) {
          await pod.db.put('manifest', this.manifest)
        }
        if (app?.reported) return
      }
    }

    if (app?.reported) return

    if (this.stage && this.manifest === null) {
      throw ERR_INVALID_PROJECT_DIR(
        `"${path.join(this.dir, 'package.json')}" not found. Pear project must have a package.json`
      )
    }

    const { dependencies } = this.manifest
    const options = this.options
    const { release } = pod
    const { main = 'index.js' } = this.manifest

    this.update({ main, options, dependencies, release })

    if (this.clearAppStorage) await fsp.rm(this.storage, { recursive: true })

    try {
      this.checkpoint = JSON.parse(await fsp.readFile(path.join(this.storage, 'checkpoint')))
    } catch {
      /* ignore */
    }
    if (app?.reported) return
    if (this.key) {
      this.version = {
        key: hypercoreid.encode(this.key),
        fork: pod.ver.fork,
        length: pod.ver.length
      }
    }
  }
}
