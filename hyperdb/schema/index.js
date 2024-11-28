// This file is autogenerated by the hyperschema compiler
// Schema Version: 1
/* eslint-disable camelcase */
/* eslint-disable quotes */

const VERSION = 1
const { c } = require('hyperschema/runtime')

// eslint-disable-next-line no-unused-vars
let version = VERSION

// @pear/node
const encoding0 = {
  preencode (state, m) {
    c.string.preencode(state, m.host)
    c.uint.preencode(state, m.port)
  },
  encode (state, m) {
    c.string.encode(state, m.host)
    c.uint.encode(state, m.port)
  },
  decode (state) {
    const res = {}
    res.host = null
    res.port = 0

    res.host = c.string.decode(state)
    res.port = c.uint.decode(state)

    return res
  }
}

// @pear/bundle
const encoding1 = {
  preencode (state, m) {

  },
  encode (state, m) {

  },
  decode (state) {
    const res = {}

    return res
  }
}

// @pear/dht.nodes
const encoding2_0 = c.frame(c.array(encoding0))

// @pear/dht
const encoding2 = {
  preencode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.preencode(state, flags)

    if (m.nodes) encoding2_0.preencode(state, m.nodes)
  },
  encode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.encode(state, flags)

    if (m.nodes) encoding2_0.encode(state, m.nodes)
  },
  decode (state) {
    const res = {}
    res.nodes = null

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((flags & 1) !== 0) res.nodes = encoding2_0.decode(state)

    return res
  }
}

// @pear/permits
const encoding3 = {
  preencode (state, m) {
    c.fixed32.preencode(state, m.key)
  },
  encode (state, m) {
    c.fixed32.encode(state, m.key)
  },
  decode (state) {
    const res = {}
    res.key = null

    res.key = c.fixed32.decode(state)

    return res
  }
}

// @pear/encryption-keys
const encoding4 = {
  preencode (state, m) {
    c.fixed32.preencode(state, m.key)
    c.string.preencode(state, m.encryptionKey)
  },
  encode (state, m) {
    c.fixed32.encode(state, m.key)
    c.string.encode(state, m.encryptionKey)
  },
  decode (state) {
    const res = {}
    res.key = null
    res.encryptionKey = null

    res.key = c.fixed32.decode(state)
    res.encryptionKey = c.string.decode(state)

    return res
  }
}

function getStructByName (name) {
  switch (name) {
    case '@pear/node': return encoding0
    case '@pear/bundle': return encoding1
    case '@pear/dht': return encoding2
    case '@pear/permits': return encoding3
    case '@pear/encryption-keys': return encoding4
    default: throw new Error('Encoder not found ' + name)
  }
}

function resolveStruct (name, v = VERSION) {
  const enc = getStructByName(name)
  return {
    preencode (state, m) {
      version = v
      enc.preencode(state, m)
    },
    encode (state, m) {
      version = v
      enc.encode(state, m)
    },
    decode (state) {
      version = v
      return enc.decode(state)
    }
  }
}

module.exports = { resolveStruct, version }
