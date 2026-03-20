'use strict'
const path = require('bare-path')
const { outputter } = require('pear-terminal')
const hypercoreid = require('hypercore-id-encoding')

class Multisig {
  static output = outputter('multisig', {
    'getting-src-blobs': () => 'Getting the source blobs...',
    'verify-db-requestable-start': () => 'Verifying the db core is requestable...',
    'getting-blobs-length': () => 'Getting the blobs length (this can take a while)...',
    'verify-blobs-requestable-start': () => 'Verifying the blobs core is requestable...',
    'creating-drive': () => 'Creating the drive...',
    comitting: ({ request, responses }) => {
      const lines = [`Committing request ${request}`]
      if (responses.length) lines.push(`Responses:\n -${responses.join('\n -')}`)
      return { output: 'status', message: lines.join('\n') }
    },
    'verify-committable-start': ({ srcKey, dstKey }) => `Verifying safe to commit (source ${hypercoreid.encode(srcKey)} to multisig target ${hypercoreid.encode(dstKey)})`,
    'commit-start': () => 'Committing...',
    'verify-committed-start': ({ firstCommit, key }) => {
      const lines = [`Committed (key ${hypercoreid.encode(key)})`, 'Waiting for remote seeders to pick up the changes...']
      if (firstCommit) lines.push('Please add this key to the seeders now. The logs here will notify you when it is picked up by them. Do not shut down until that happens.')
      return lines
    },
    final: (data) => {
      if (data.link) return data.link + '\n'
      if (data.request) return data.request + '\n'
      const { dstKey, dryRun, quorum, result } = data
      const lines = dryRun
        ? [`\nQuorum: ${quorum.total} / ${quorum.amount}`, 'Review batch to commit: ' + JSON.stringify(result, null, 2)]
        : ['Committed: ' + JSON.stringify(result, null, 2), '\n~ DONE ~ Seeding now ~ Press Ctrl+C to exit ~\n']
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

  async request() {
    const { force, peerUpdateTimeout } = this.cmd.flags
    const { link } = this.cmd.args
    await Multisig.output(
      this.json,
      this.ipc.multisig({ action: 'request', package: this.package, link, force, peerUpdateTimeout })
    )
  }

  async verify() {
    const { peerUpdateTimeout } = this.cmd.flags
    const { link, request } = this.cmd.args
    const responses = this.cmd.rest
    await Multisig.output(
      this.json,
      this.ipc.multisig({ action: 'verify', package: this.package, link, request, peerUpdateTimeout, responses })
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
