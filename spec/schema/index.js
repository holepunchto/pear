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
    const r0 = c.string.decode(state)
    const r1 = c.uint.decode(state)

    return {
      host: r0,
      port: r1
    }
  }
}

// @pear/dht.nodes
const encoding1_0 = c.frame(c.array(encoding0))

// @pear/dht
const encoding1 = {
  preencode (state, m) {
    state.end++ // max flag is 1 so always one byte

    if (m.nodes) encoding1_0.preencode(state, m.nodes)
  },
  encode (state, m) {
    const flags = m.nodes ? 1 : 0

    c.uint.encode(state, flags)

    if (m.nodes) encoding1_0.encode(state, m.nodes)
  },
  decode (state) {
    const flags = c.uint.decode(state)

    return {
      nodes: (flags & 1) !== 0 ? encoding1_0.decode(state) : null
    }
  }
}

// @pear/bundle.tags
const encoding2_3 = c.array(c.string)

// @pear/bundle
const encoding2 = {
  preencode (state, m) {
    c.string.preencode(state, m.link)
    c.string.preencode(state, m.appStorage)
    state.end++ // max flag is 2 so always one byte

    if (m.encryptionKey) c.fixed32.preencode(state, m.encryptionKey)
    if (m.tags) encoding2_3.preencode(state, m.tags)
  },
  encode (state, m) {
    const flags =
      (m.encryptionKey ? 1 : 0) |
      (m.tags ? 2 : 0)

    c.string.encode(state, m.link)
    c.string.encode(state, m.appStorage)
    c.uint.encode(state, flags)

    if (m.encryptionKey) c.fixed32.encode(state, m.encryptionKey)
    if (m.tags) encoding2_3.encode(state, m.tags)
  },
  decode (state) {
    const r0 = c.string.decode(state)
    const r1 = c.string.decode(state)
    const flags = c.uint.decode(state)

    return {
      link: r0,
      appStorage: r1,
      encryptionKey: (flags & 1) !== 0 ? c.fixed32.decode(state) : null,
      tags: (flags & 2) !== 0 ? encoding2_3.decode(state) : null
    }
  }
}

// @pear/gc
const encoding3 = {
  preencode (state, m) {
    c.string.preencode(state, m.type)
    c.string.preencode(state, m.value)
  },
  encode (state, m) {
    c.string.encode(state, m.type)
    c.string.encode(state, m.value)
  },
  decode (state) {
    const r0 = c.string.decode(state)
    const r1 = c.string.decode(state)

    return {
      type: r0,
      value: r1
    }
  }
}

function setVersion (v) {
  version = v
}

function encode (name, value, v = VERSION) {
  version = v
  return c.encode(getEncoding(name), value)
}

function decode (name, buffer, v = VERSION) {
  version = v
  return c.decode(getEncoding(name), buffer)
}

function getEnum (name) {
  switch (name) {
    default: throw new Error('Enum not found ' + name)
  }
}

function getEncoding (name) {
  switch (name) {
    case '@pear/node': return encoding0
    case '@pear/dht': return encoding1
    case '@pear/bundle': return encoding2
    case '@pear/gc': return encoding3
    default: throw new Error('Encoder not found ' + name)
  }
}

function getStruct (name, v = VERSION) {
  const enc = getEncoding(name)
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

module.exports = { resolveStruct: getStruct, getStruct, getEnum, getEncoding, encode, decode, setVersion, version }
