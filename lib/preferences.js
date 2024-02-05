'use strict'
const { join } = require('bare-path')
const { readFileSync } = require('bare-fs')
const { writeFile, rename } = require('bare-fs/promises')
const mutexify = require('mutexify/promise')
const Iambus = require('iambus')
const { PLATFORM_DIR } = require('./constants')

const preferences = join(PLATFORM_DIR, 'preferences.json')
const next = join(PLATFORM_DIR, 'preferences.next.json')

let settings = {}
try { settings = JSON.parse(readFileSync(preferences)) } catch {}

// singleton:
module.exports = new class Preferences {
  #mutexify = null
  #writes = 0
  bus = new Iambus()
  constructor () {
    this.#mutexify = mutexify()
  }

  async set (key, value) {
    settings[key] = value
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

      await writeFile(next, JSON.stringify(settings))
      await rename(next, preferences)

      this.#writes -= writes
    } catch (err) {
      console.error(err)
    } finally {
      release()
    }
  }

  async get (key) {
    return settings[key]
  }

  async clear () {
    settings = {}
    this.#update(['clear'])
    await this.#flush()
    return true
  }

  #update (data) { return this.bus.pub({ topic: 'update', data }) }

  updates () { return this.bus.sub({ topic: 'update' }) }

  entries () { return Object.entries(settings) }
}()
