'use strict'
const fs = require('bare-fs')
const DBLock = require('db-lock')
const plink = require('pear-link')

if (global.LOG === undefined) global.LOG = { trace() {} }
const LOG = global.LOG

const applink = (link, { alias = true } = {}) => {
  const parsed = typeof link === 'string' ? plink.parse(link) : { ...link }
  if (alias === false) parsed.alias = null
  const ser = plink.serialize(parsed)
  return plink.parse(ser).origin
}

class Lock extends DBLock {
  #manual = false
  #tx = null
  constructor(db) {
    super({
      enter: () => {
        this.#tx = db.transaction()
        return this.#tx
      },
      exit: (tx) => tx.flush(),
      maxParallel: 1
    })
  }

  enter() {
    if (this.#manual && this.#tx !== null) return this.#tx
    return super.enter()
  }

  exit() {
    if (this.#manual) return Promise.resolve()
    return super.exit()
  }

  manual() {
    this.#manual = true
    return async () => {
      try {
        await super.exit()
      } finally {
        this.#manual = false
      }
    }
  }
}

class Model {
  constructor(rocks) {
    this.db = rocks
    this.lock = new Lock(this.db)
  }

  async allGc() {
    LOG.trace('db', 'FIND', '@pear/gc')
    return await this.db.find('@pear/gc').toArray()
  }

  async gc() {
    LOG.trace('db', 'FIND ONE', '@pear/gc')
    const entry = await this.db.findOne('@pear/gc')
    if (entry) {
      LOG.trace('db', 'GC removing directory', entry.path)
      await fs.promises.rm(entry.path, { recursive: true, force: true })
      const get = { path: entry.path }
      const tx = await this.lock.enter()
      LOG.trace('db', 'DELETE', '@pear/gc', get)
      await tx.delete('@pear/gc', get)
      await this.lock.exit()
    } else {
      LOG.trace('db', 'GC is clear')
    }
  }

  async getPresets(link, command) {
    const get = { link: applink(link), command }
    LOG.trace('db', 'GET', '@pear/presets-by-command', get)
    const presets = await this.db.get('@pear/presets-by-command', get)
    return presets || null
  }

  async setPresets(link, command, flags) {
    const tx = await this.lock.enter()
    const presets = { link, command, flags }
    LOG.trace('db', 'INSERT', '@pear/presets', presets)
    await tx.insert('@pear/presets', presets)
    await this.lock.exit()
    return presets
  }

  async resetPresets(link, command) {
    const tx = await this.lock.enter()
    const get = { link: applink(link), command }
    LOG.trace('db', 'GET', '@pear/presets-by-command', get)
    const del = await tx.get('@pear/presets-by-command', get)
    if (del) {
      LOG.trace('db', 'DELETE', '@pear/presets-by-command', del)
      await tx.delete('@pear/presets', del)
    }
    await this.lock.exit()
  }

  async close() {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }
}

exports.spec = require('../../../spec/db')
exports.Model = Model
