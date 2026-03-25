'use strict'
const path = require('bare-path')
const { outputter, password } = require('pear-terminal')
const hypercoreid = require('hypercore-id-encoding')
const z32 = require('z32')
const fs = require('bare-fs')
const sodium = require('sodium-native')
const hs = require('hypercore-sign')
const { PLATFORM_DIR } = require('pear-constants')
const { ERR_INVALID_INPUT } = require('pear-errors')

class Multisig {
  static output = outputter('multisig', {
    'getting-src-blobs': () => 'Getting the source blobs...',
    'verify-db-requestable-start': () => 'Verifying the db core is requestable...',
    'getting-blobs-length': () => 'Getting the blobs length (this can take a while)...',
    'verify-blobs-requestable-start': () => 'Verifying the blobs core is requestable...',
    'creating-drive': () => 'Creating the drive...',
    multisigging: ({ request, responses, dryRun }) => {
      let message = (dryRun ? 'Verifying' : 'Committing') + ' request: ' + request
      if (responses.length) message += 'Responses:\n - ' + responses.join('\n -')
      return message
    },
    'verify-committable-start': ({ srcKey, dstKey }) =>
      `Verifying safe to commit (source ${hypercoreid.encode(srcKey)} to multisig target ${hypercoreid.encode(dstKey)})`,
    'commit-start': () => 'Committing...',
    'verify-committed-start': ({ firstCommit, key }) => {
      const lines = [
        `Committed (key ${hypercoreid.encode(key)})`,
        'Waiting for remote seeders to pick up the changes...'
      ]
      if (firstCommit) {
        lines.push(
          'Please add this key to the seeders now. The logs here will notify you when it is picked up by them. Do not shut down until that happens.'
        )
      }
      return lines
    },

    sign: ({ response }) => response,

    keys: ({ paths, pub, prv, publicKey }) => {
      const pkey = hypercoreid.encode(publicKey)
      if (paths) return 'public: ' + pub + '\nprivate: ' + prv + '\npubkey: ' + pkey + '\n'
      return pkey + '\n'
    },

    final: (data) => {
      if (!data) return {}
      if (data.link) return { output: 'print', success: Infinity, message: data.link }
      if (data.request) return { output: 'print', success: Infinity, message: data.request }
      const { dstKey, dryRun, quorum, result } = data
      const lines = dryRun
        ? [
            `\nQuorum: ${quorum.total} / ${quorum.amount}`,
            'Review batch to commit: ' + JSON.stringify(result, null, 2)
          ]
        : [
            'Committed: ' + JSON.stringify(result, null, 2),
            '\n~ DONE ~ Seeding now ~ Press Ctrl+C to exit ~\n'
          ]
      lines.push(`dst key: ${dstKey}`)
      return lines.join('\n')
    }
  })

  constructor(cmd) {
    this.cmd = cmd
    this.ipc = global.Pear[global.Pear.constructor.IPC]
    this.json = cmd.command.parent.flags.json
    this.package = cmd.command.flags.package ?? path.resolve('package.json')
  }

  async link() {
    await Multisig.output(this.json, this.ipc.multisig({ action: 'link', package: this.package }))
  }

  async keys() {
    const { paths } = this.cmd.flags
    const sign = path.join(PLATFORM_DIR, 'sign')
    const pub = path.join(sign, 'default.public')
    const prv = path.join(sign, 'default')
    if (fs.existsSync(pub)) {
      await Multisig.output(this.json, [
        { tag: 'keys', data: { paths, pub, prv, publicKey: fs.readFileSync(pub) } },
        { tag: 'final' }
      ])
      return
    }
    const input = await password()
    const pwd = sodium.sodium_malloc(Buffer.byteLength(input))
    pwd.write(input)
    const { publicKey, secretKey } = hs.generateKeys(pwd)
    fs.mkdirSync(sign, { recursive: true })
    fs.writeFileSync(path.join(sign, 'default.public'), publicKey)
    fs.writeFileSync(path.join(sign, 'default'), secretKey)
    await Multisig.output(this.json, [
      { tag: 'keys', data: { paths, pub, prv, publicKey } },
      { tag: 'final' }
    ])
  }

  async sign() {
    const { request } = this.cmd.args
    if (!request) {
      throw ERR_INVALID_INPUT('request argument required')
    }
    const key = fs.readFileSync(path.join(PLATFORM_DIR, 'sign', 'default'))
    const input = await password()
    const pwd = sodium.sodium_malloc(Buffer.byteLength(input))
    pwd.write(input)

    const response = z32.encode(hs.sign(z32.decode(request), key, pwd))
    await Multisig.output(this.json, [{ tag: 'sign', data: { response } }, { tag: 'final' }])
  }

  async request() {
    const { force, peerUpdateTimeout } = this.cmd.flags
    const { verlink } = this.cmd.args
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'request',
        package: this.package,
        verlink,
        force,
        peerUpdateTimeout
      })
    )
  }

  async verify() {
    const { forceDangerous, peerUpdateTimeout } = this.cmd.flags
    const { link, request } = this.cmd.args
    const responses = this.cmd.rest
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'verify',
        package: this.package,
        link,
        request,
        responses,
        forceDangerous,
        peerUpdateTimeout
      })
    )
  }

  async commit() {
    const { dryRun, forceDangerous, peerUpdateTimeout } = this.cmd.flags
    const { link, request } = this.cmd.args
    const responses = this.cmd.rest
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'commit',
        package: this.package,
        dryRun,
        link,
        request,
        responses,
        forceDangerous,
        peerUpdateTimeout
      })
    )
  }
}

module.exports = (cmd) => new Multisig(cmd)[cmd.command.name]()
