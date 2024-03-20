'use strict'
const cenc = require('compact-encoding')
const fsp = require('bare-fs/promises')
const mutexify = require('mutexify/promise')
const ReadyResource = require('ready-resource')
const constants = require('./constants')

const APPLINGS_STORAGE_VERSION = 0

const ApplingEntry = {
  preencode (state, m) {
    cenc.string.preencode(state, m.path)
    cenc.string.preencode(state, m.key)
  },
  encode (state, m) {
    cenc.string.encode(state, m.path)
    cenc.string.encode(state, m.key)
  },
  decode (state) {
    const res = {
      path: cenc.string.decode(state),
      key: cenc.string.decode(state)
    }

    return res
  }
}

const ApplingEntryArray = cenc.array(ApplingEntry)
const ApplingsEnc = {
  preencode (state, m) {
    cenc.uint.preencode(state, m.version)
    ApplingEntryArray.preencode(state, m.entries)
  },
  encode (state, m) {
    cenc.uint.encode(state, m.version)
    ApplingEntryArray.encode(state, m.entries)
  },
  decode (state) {
    return {
      version: cenc.uint.decode(state),
      entries: ApplingEntryArray.decode(state)
    }
  }
}

async function readApplingsFile (location) {
  let applingsContent
  try {
    applingsContent = await fsp.readFile(location)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  return decodeApplings(applingsContent, location)
}

function decodeApplings (applings) {
  let parsedContent = { version: APPLINGS_STORAGE_VERSION, entries: [] }
  if (applings) {
    parsedContent = cenc.decode(ApplingsEnc, applings)
  }

  return parsedContent
}

async function writeApplings (entries, applingsLoc) {
  const decodedContent = {
    version: APPLINGS_STORAGE_VERSION, entries
  }

  const tempApplingsLoc = applingsLoc + '.temp'
  const encodedContent = cenc.encode(ApplingsEnc, decodedContent)

  await fsp.writeFile(tempApplingsLoc, encodedContent)
  await fsp.rename(tempApplingsLoc, applingsLoc) // Atomic rewrite
}

class Applings extends ReadyResource {
  constructor (applingsPath) {
    super()

    this.path = applingsPath
    this._mutex = mutexify()
    this._applings = null
    this._writes = 0
  }

  async _open () {
    const parsedApplings = await readApplingsFile(this.path)
    this._applings = parsedApplings.entries
    this._applingsVersion = parsedApplings.version
  }

  async _close () {
    await this._mutex() // Ensure final changes flushed
  }

  get flushable () {
    return this._applingsVersion === APPLINGS_STORAGE_VERSION && !this.closing
  }

  async set (hexKey, path) {
    if (!this.opened) await this.ready()
    if (hexKey === constants.ALIASES.keet.hex) hexKey = 'keet'
    if (hexKey === constants.ALIASES.runtime.hex) hexKey = 'runtime'

    let found = false
    for (const entry of this._applings) {
      if (entry.key === hexKey) {
        if (entry.path === path) return false
        found = true
        entry.path = path
        break
      }
    }

    if (!found) {
      this._applings.push({ key: hexKey, path })
    }

    await this.#flush()
    return true
  }

  async #flush () {
    this._writes++

    if (!this.flushable) {
      console.warn('Cannot flush applings file to disk')
      return
    }

    const release = await this._mutex()

    if (!this._writes) {
      release()
      return
    }

    const writesPreFlush = this._writes

    try {
      await writeApplings(this._applings, this.path)
    } catch (err) {
      console.error(`Could not flush applings file to disk: ${err.stack}`)
    } finally {
      this._writes -= writesPreFlush
      release()
    }
  }

  async get (hexKey) {
    if (!this.opened) await this.ready()
    if (hexKey === constants.ALIASES.keet.hex || hexKey === constants.EOLS.keet.hex) hexKey = 'keet'
    if (hexKey === constants.ALIASES.runtime.hex) hexKey = 'runtime'
    for (const { key, path } of this._applings) {
      if (key === hexKey) return path
    }
  }
}

module.exports = Applings
