'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const { outputter, password } = require('pear-terminal')
const { generateKeys } = require('hypercore-sign')
const { PLATFORM_DIR } = require('pear-constants')

const output = outputter('keygen', {
  final: ({ paths, pub, prv, publicKey }) => {
    const pkey = hypercoreid.encode(publicKey)
    if (paths) return 'public: ' + pub + '\nprivate:' + prv + '\npubkey:' + pkey + '\n'
    return pkey + '\n'
  }
})

module.exports = async function keygen(cmd) {
  const { json, paths } = cmd.flags
  const sign = path.join(PLATFORM_DIR, 'sign')
  const pub = path.join(sign, 'default.public')
  const prv = path.join(sign, 'default')
  if (fs.existsSync(pub)) {
    await output(json, [
      { tag: 'final', data: { paths, pub, prv, publicKey: fs.readFileSync(pub) } }
    ])
    return
  }
  const pwd = await password()
  const { publicKey, secretKey } = generateKeys(pwd)
  fs.mkdirSync(sign, { recursive: true })
  fs.writeFileSync(path.join(sign, 'default.public'), publicKey)
  fs.writeFileSync(path.join(sign, 'default'), secretKey)
  await output(json, [{ tag: 'final', data: { paths, pub, prv, publicKey } }])
}
