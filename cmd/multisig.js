'use strict'
const path = require('bare-path')
const os = require('bare-os')
const { outputter, password } = require('pear-terminal')
const hypercoreid = require('hypercore-id-encoding')
const z32 = require('z32')
const fs = require('bare-fs')
const sodium = require('sodium-native')
const Localdrive = require('localdrive')
const hs = require('hypercore-sign')
const plink = require('pear-link')
const { ERR_INVALID_INPUT, ERR_INVALID_CONFIG } = require('pear-errors')
const HOME = os.homedir()
const SIGN = path.join(HOME, '.pear-sign')
const replacer = (key, value) => (Buffer.isBuffer(value) ? z32.encode(value) : value)

class Keys {
  static output = outputter('keys', {
    key: ({ paths, pub, prv, publicKey, privateKey, at, name }) => {
      if (paths) return 'public: ' + pub + '\nprivate: ' + prv + '\n'
      let out = name + '\n'
      out += '  ' + (at ? at.pub + ' ' : '') + z32.encode(publicKey) + '\n'
      if (privateKey) {
        out += '  ' + (at ? at.prv + ' ' : '') + z32.encode(privateKey) + '\n'
      }
      return out
    },

    list: ({ keys }) => {
      if (!keys.length) return '(no keys)\n'
      return (
        keys
          .map(({ name, publicKey, at }) => {
            return name + '\n  ' + (at ? at.pub + ' ' : '') + z32.encode(publicKey)
          })
          .join('\n\n') + '\n'
      )
    },

    removed: ({ name }) => {
      return { output: 'print', message: '' + name + ' removed', success: true }
    },

    final: () => ({})
  })

  constructor(cmd) {
    this.cmd = cmd
    this.json = cmd.command.flags.json && replacer
    const name = cmd.args.name || 'default'
    if (!/^[\w-]+$/.test(name)) {
      throw ERR_INVALID_INPUT(
        'Key name must contain only letters, numbers, hyphens, or underscores'
      )
    }
    this.name = name
    this.pub = path.join(SIGN, this.name + '.public')
    this.prv = path.join(SIGN, this.name)
  }

  async get() {
    const { secret } = this.cmd.flags
    if (fs.existsSync(this.pub)) {
      const data = {
        name: this.name,
        pub: this.pub,
        prv: this.prv,
        publicKey: fs.readFileSync(this.pub),
        at: { pub: this.pub.replace(HOME, '~'), prv: this.prv.replace(HOME, '~') }
      }
      if (secret) {
        data.privateKey = fs.existsSync(this.prv) ? fs.readFileSync(this.prv) : '(no secret key)'
      }
      await Keys.output(this.json, [{ tag: 'key', data }, { tag: 'final' }])
      return
    }
    const input = await password()
    const pwd = sodium.sodium_malloc(Buffer.byteLength(input))
    pwd.write(input)
    const { publicKey, secretKey } = hs.generateKeys(pwd)
    fs.mkdirSync(SIGN, { recursive: true })
    fs.writeFileSync(this.pub, publicKey)
    fs.writeFileSync(this.prv, secretKey)
    const data = {
      name: this.name,
      pub: this.pub,
      prv: this.prv,
      publicKey,
      at: { pub: this.pub.replace(HOME, '~'), prv: this.prv.replace(HOME, '~') }
    }
    if (secret) data.privateKey = secretKey
    await Keys.output(this.json, [{ tag: 'key', data }, { tag: 'final' }])
  }

  async paths() {
    await Keys.output(this.json, [
      { tag: 'key', data: { paths: true, pub: this.pub, prv: this.prv } },
      { tag: 'final' }
    ])
  }

  async add() {
    const pubKey = this.cmd.args.publicKey
    if (!this.cmd.args.publicKey) throw ERR_INVALID_INPUT('<public-key> is required')
    if (fs.existsSync(this.pub)) throw ERR_INVALID_INPUT(`Key "${this.name}" already exists`)
    const publicKey = fs.existsSync(pubKey)
      ? z32.decode(fs.readFileSync(pubKey, 'utf8').trim())
      : z32.decode(pubKey)
    fs.mkdirSync(SIGN, { recursive: true })
    fs.writeFileSync(this.pub, publicKey)
    if (this.cmd.args.privateKey) {
      const prvKey = this.cmd.args.privateKey
      const privateKey = fs.existsSync(prvKey)
        ? z32.decode(fs.readFileSync(prvKey, 'utf8').trim())
        : z32.decode(prvKey)
      fs.writeFileSync(this.prv, privateKey)
    }
    await Keys.output(this.json, [
      {
        tag: 'key',
        data: {
          name: this.name,
          pub: this.pub,
          prv: this.prv,
          publicKey,
          at: { pub: this.pub.replace(HOME, '~'), prv: this.prv.replace(HOME, '~') }
        }
      },
      { tag: 'final' }
    ])
  }

  async remove() {
    if (!fs.existsSync(this.pub)) throw ERR_INVALID_INPUT(`Key "${this.name}" not found`)
    fs.unlinkSync(this.pub)
    if (fs.existsSync(this.prv)) fs.unlinkSync(this.prv)
    await Keys.output(this.json, [{ tag: 'removed', data: { name: this.name } }, { tag: 'final' }])
  }

  async list() {
    const keys = []
    const drive = new Localdrive(SIGN)
    for await (const entry of drive.list('/')) {
      if (!entry.key.endsWith('.public')) continue
      const name = entry.key.slice(1, -7)
      const publicKey = await drive.get(entry.key)
      const owned = (await drive.entry('/' + name)) !== null
      keys.push({
        name,
        publicKey,
        owned,
        at: {
          pub: path.join(SIGN, name + '.public').replace(HOME, '~'),
          prv: path.join(SIGN, name).replace(HOME, '~')
        }
      })
    }
    await Keys.output(this.json, [{ tag: 'list', data: { keys } }, { tag: 'final' }])
  }
}

class Multisig {
  static subcommands = new Map([['keys', Keys]])
  static output = outputter('multisig', {
    multisigging: ({ request, responses, dryRun }) => {
      let message = (dryRun ? 'Verifying' : 'Committing') + ' request: ' + request
      if (responses.length) message += 'Responses:\n - ' + responses.join('\n -')
      return message
    },
    'getting-src-blobs': () => 'Getting the source blobs...',
    'verify-db-requestable-start': () => 'Verifying the db core is requestable...',
    'getting-blobs-length': () => 'Getting the blobs length (this can take a while)...',
    'verify-blobs-requestable-start': () => 'Verifying the blobs core is requestable...',
    'creating-drive': () => 'Creating the drive...',
    'verify-committable-start': ({ srcKey, dstKey }) =>
      `Verifying safe to commit (source ${hypercoreid.encode(srcKey)} to multisig target ${hypercoreid.encode(dstKey)})`,
    'commit-start': ({ dryRun }) => (dryRun ? 'Verifying...' : 'Committing...'),
    'verify-committed-start': ({ firstCommit, key, link }) => {
      let lines = `Committed (key ${hypercoreid.encode(key)})\nWaiting for remote seeders to pick up the changes...`
      if (firstCommit) {
        lines += `Make sure ${link} is seeded. Once seeded, the process will continue. Do not exit until seeding is confirmed`
      }
      return lines
    },

    sign: ({ response, at }) => 'Response signed by ' + at.prv + ':\n\n' + response,

    final: (data) => {
      if (!data) return {}
      if (data.link) return { output: 'print', success: Infinity, message: data.link, nonl: true }
      if (data.request) return { output: 'print', success: Infinity, message: data.request }
      const { dstKey, dryRun, quorum, result } = data
      const link = plink.serialize({ drive: { key: dstKey } })
      const verlink = plink.serialize({
        drive: {
          key: dstKey,
          length: result.db.destCore.length,
          fork: result.db.destCore.fork ?? 0
        }
      })
      return (
        `\nQuorum: ${quorum.total} / ${quorum.amount}\n` +
        (dryRun ? 'Dry-run: ' : 'Committed: ') +
        JSON.stringify(result, null, 2) +
        '\n' +
        'link: ' +
        link +
        '\n' +
        'verlink: ' +
        verlink +
        '\n' +
        'seed: pear seed ' +
        link
      )
    }
  })

  constructor(cmd) {
    this.cmd = cmd
    this.ipc = global.Pear[global.Pear.constructor.IPC]
    this.json = cmd.command.flags.json && replacer
    this.config = cmd.command.flags.config ?? path.resolve('pear.json')
  }

  _config() {
    let config
    try {
      config = JSON.parse(fs.readFileSync(this.config))
    } catch (err) {
      const invalidPath =
        err.code === 'ENOENT' ||
        err.code === 'EACCES' ||
        err.code === 'EPERM' ||
        err.code === 'ENOTDIR' ||
        err.code === 'EMFILE' ||
        err.code === 'ENFILE'
      if (invalidPath) throw ERR_INVALID_INPUT(err.message)
      throw ERR_INVALID_CONFIG('Could not parse config ' + this.config + ': ' + err.message)
    }
    if (!config.multisig) throw ERR_INVALID_CONFIG('multisig field required in ' + this.config)
    if (!config.multisig.publicKeys) {
      throw ERR_INVALID_CONFIG('multisig.publicKeys field required in ' + this.config)
    }
    if (!config.multisig.quorum) {
      throw ERR_INVALID_CONFIG('multisig.quorum field required in ' + this.config)
    }
    if (!config.multisig.namespace) {
      throw ERR_INVALID_CONFIG('multisig.namespace field required in ' + this.config)
    }
    return config.multisig
  }

  async link() {
    const config = this._config()
    await Multisig.output(this.json, this.ipc.multisig({ action: 'link', ...config }))
  }

  async sign() {
    const { request } = this.cmd.args
    if (!request) throw ERR_INVALID_INPUT('request argument required')
    const req = z32.decode(request)
    if (!hs.isRequest(req)) throw ERR_INVALID_INPUT('Invalid request: ' + request)
    const name = this.cmd.args.name || 'default'
    if (!/^[\w-]+$/.test(name)) {
      throw ERR_INVALID_INPUT(
        'Key name must contain only letters, numbers, hyphens, or underscores'
      )
    }
    const prv = path.join(SIGN, name)
    if (!fs.existsSync(prv)) throw ERR_INVALID_INPUT(`No private key found for "${name}"`)
    const key = fs.readFileSync(prv)
    const input = await password()
    const pwd = sodium.sodium_malloc(Buffer.byteLength(input))
    pwd.write(input)

    const pub = path.join(SIGN, name + '.public')
    const at = { pub: pub.replace(HOME, '~'), prv: prv.replace(HOME, '~') }
    const response = z32.encode(hs.sign(req, key, pwd))
    await Multisig.output(this.json, [{ tag: 'sign', data: { response, at } }, { tag: 'final' }])
  }

  async request() {
    const { force, peerUpdateTimeout } = this.cmd.flags
    const { verlink } = this.cmd.args
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'request',
        ...this._config(),
        verlink,
        force,
        peerUpdateTimeout
      })
    )
  }

  async verify() {
    const { forceDangerous, peerUpdateTimeout } = this.cmd.flags
    const { sourceLink, request } = this.cmd.args
    const responses = this.cmd.rest
    const req = z32.decode(request)
    if (!hs.isRequest(req)) throw ERR_INVALID_INPUT('Invalid request: ' + request)
    for (const response of responses) {
      const res = z32.decode(response)
      if (!hs.isResponse(res)) throw ERR_INVALID_INPUT('Invalid response:' + response)
    }
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'verify',
        ...this._config(),
        link: sourceLink,
        request,
        responses,
        forceDangerous,
        peerUpdateTimeout
      })
    )
  }

  async commit() {
    const { dryRun, forceDangerous, peerUpdateTimeout } = this.cmd.flags
    const { sourceLink, request } = this.cmd.args
    const responses = this.cmd.rest
    const req = z32.decode(request)
    if (!hs.isRequest(req)) throw ERR_INVALID_INPUT('Invalid request: ' + request)
    for (const response of responses) {
      const res = z32.decode(response)
      if (!hs.isResponse(res)) throw ERR_INVALID_INPUT('Invalid response: ' + response)
    }
    await Multisig.output(
      this.json,
      this.ipc.multisig({
        action: 'commit',
        ...this._config(),
        dryRun,
        link: sourceLink,
        request,
        responses,
        forceDangerous,
        peerUpdateTimeout
      })
    )
  }
}

module.exports = (cmd) => {
  const parent = cmd.command.parent
  if (parent && Multisig.subcommands.has(parent.name)) {
    const Subcommand = Multisig.subcommands.get(parent.name)
    return new Subcommand(cmd)[cmd.command.name]()
  }
  return new Multisig(cmd)[cmd.command.name]()
}
