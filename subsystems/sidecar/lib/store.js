'use strict'
const { join } = require('bare-path')
const { readFileSync } = require('bare-fs')
const { writeFile, rename } = require('bare-fs/promises')
const mutexify = require('mutexify/promise')
const Iambus = require('iambus')
const { PLATFORM_DIR } = require('../../../constants')

module.exports = class Store {
  #mutexify = null
  #writes = 0
  bus = new Iambus()
  static stores = new Map()
  constructor (name) {
    if (this.constructor.stores.has(name)) return this.constructor.stores.get(name)
    this.constructor.stores.set(name, this)
    this.current = join(PLATFORM_DIR, name + '.json')
    this.next = join(PLATFORM_DIR, name + '.next.json')
    this.data = {}
    try { this.data = JSON.parse(readFileSync(this.current)) } catch {}
    this.#mutexify = mutexify()
  }

  async set (key, value) {
    this.data[key] = value
    this.#update(['set', key, value])
    await this.#flush()
    return true
  }

  async #flush () {
    this.#writes++

    const release = await this.#mutexify()

    if (!this.#writes) {
      release()
      return
    }

    try {
      const writes = this.#writes

      await writeFile(this.next, JSON.stringify(this.data))
      await rename(this.next, this.current)

      this.#writes -= writes
    } catch (err) {
      console.error(err)
    } finally {
      release()
    }
  }

  async get (key) {
    return this.data[key]
  }

  async clear () {
    this.data = {}
    this.#update(['clear'])
    await this.#flush()
    return true
  }

  #update (data) { return this.bus.pub({ topic: 'update', data }) }

  updates () { return this.bus.sub({ topic: 'update' }) }

  entries () { return Object.entries(this.data) }
}
