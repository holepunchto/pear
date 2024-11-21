// This file is autogenerated by the hyperschema compiler
// Schema Version: 2
/* eslint-disable camelcase */
/* eslint-disable quotes */

const VERSION = 2
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

// @pear/dht.nodes
const encoding1_0 = c.frame(c.array(encoding0))

// @pear/dht
const encoding1 = {
  preencode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.preencode(state, flags)

    if (m.nodes) encoding1_0.preencode(state, m.nodes)
  },
  encode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.encode(state, flags)

    if (m.nodes) encoding1_0.encode(state, m.nodes)
  },
  decode (state) {
    const res = {}
    res.nodes = null

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((flags & 1) !== 0) res.nodes = encoding1_0.decode(state)

    return res
  }
}

// @pear/keyPair
const encoding2 = {
  preencode (state, m) {
    let flags = 0
    if ((version >= 2) && m.secretKey) flags |= 1

    c.fixed32.preencode(state, m.publicKey)
    c.uint.preencode(state, flags)

    if ((version >= 2) && m.secretKey) c.fixed32.preencode(state, m.secretKey)
  },
  encode (state, m) {
    let flags = 0
    if ((version >= 2) && m.secretKey) flags |= 1

    c.fixed32.encode(state, m.publicKey)
    c.uint.encode(state, flags)

    if ((version >= 2) && m.secretKey) c.fixed32.encode(state, m.secretKey)
  },
  decode (state) {
    const res = {}
    if (version >= 2) res.publicKey = null
    if (version >= 2) res.secretKey = null

    res.publicKey = c.fixed32.decode(state)

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((version >= 2) && (flags & 1) !== 0) res.secretKey = c.fixed32.decode(state)

    return res
  }
}

// @pear/identity.keyPair
const encoding3_0 = c.frame(encoding2)

// @pear/identity
const encoding3 = {
  preencode (state, m) {
    let flags = 0
    if ((version >= 2) && m.keyPair) flags |= 1

    c.uint.preencode(state, flags)

    if ((version >= 2) && m.keyPair) encoding3_0.preencode(state, m.keyPair)
  },
  encode (state, m) {
    let flags = 0
    if ((version >= 2) && m.keyPair) flags |= 1

    c.uint.encode(state, flags)

    if ((version >= 2) && m.keyPair) encoding3_0.encode(state, m.keyPair)
  },
  decode (state) {
    const res = {}
    if (version >= 2) res.keyPair = null

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((version >= 2) && (flags & 1) !== 0) res.keyPair = encoding3_0.decode(state)

    return res
  }
}

// @pear/dht/value.nodes
const encoding4_0 = c.frame(c.array(encoding0))

// @pear/dht/value
const encoding4 = {
  preencode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.preencode(state, flags)

    if (m.nodes) encoding4_0.preencode(state, m.nodes)
  },
  encode (state, m) {
    let flags = 0
    if (m.nodes) flags |= 1

    c.uint.encode(state, flags)

    if (m.nodes) encoding4_0.encode(state, m.nodes)
  },
  decode (state) {
    const res = {}
    res.nodes = null

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((flags & 1) !== 0) res.nodes = encoding4_0.decode(state)

    return res
  }
}

// @pear/identity/value.keyPair
const encoding5_0 = c.frame(encoding2)

// @pear/identity/value
const encoding5 = {
  preencode (state, m) {
    let flags = 0
    if ((version >= 2) && m.keyPair) flags |= 1

    c.uint.preencode(state, flags)

    if ((version >= 2) && m.keyPair) encoding5_0.preencode(state, m.keyPair)
  },
  encode (state, m) {
    let flags = 0
    if ((version >= 2) && m.keyPair) flags |= 1

    c.uint.encode(state, flags)

    if ((version >= 2) && m.keyPair) encoding5_0.encode(state, m.keyPair)
  },
  decode (state) {
    const res = {}
    if (version >= 2) res.keyPair = null

    const flags = state.start < state.end ? c.uint.decode(state) : 0
    if ((version >= 2) && (flags & 1) !== 0) res.keyPair = encoding5_0.decode(state)

    return res
  }
}

function getStructByName (name) {
  switch (name) {
    case '@pear/node': return encoding0
    case '@pear/dht': return encoding1
    case '@pear/keyPair': return encoding2
    case '@pear/identity': return encoding3
    case '@pear/dht/value': return encoding4
    case '@pear/identity/value': return encoding5
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
