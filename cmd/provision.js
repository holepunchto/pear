'use strict'
const context = require('../context')
const { outputter, ansi, byteDiff, hint } = require('../lib/terminal.js')
const { parse } = require('../lib/link')

const output = outputter('provision', {
  ['byte-diff']: byteDiff,
  syncing: ({ type }) => 'Syncing existing ' + type + ', please wait...',
  blocks: ({ type, targetLength, productionLength }) => {
    return {
      output: 'status',
      message: 'Synced ' + type + ' blocks ' + targetLength + ' / ' + productionLength
    }
  },
  synced: ({ type }) => '\n' + ansi.green('Completed ' + type + ' sync'),
  diffing: () => 'Checking diff\n',
  diffed: ({ changes, semver, target }) => {
    const { core, blobs } = target
    return (
      ansi.green('Diffing complete') +
      '\nTotal changes: ' +
      ansi.green(changes) +
      '\nPackage version: ' +
      ansi.green(semver) +
      '\n\nCore:\n' +
      '  Key: ' +
      ansi.gray(core.id) +
      '\n  Length: ' +
      core.length +
      '\n  Hash: ' +
      core.hash +
      '\n\nBlobs:\n' +
      '  Key: ' +
      ansi.gray(blobs.id) +
      '\n  Length: ' +
      blobs.length +
      '\n  Hash: ' +
      blobs.hash +
      '\n'
    )
  },
  dry: () => ansi.green('Dry Run Complete') + '\n',
  cooldown: ({ time }) => {
    return (
      ansi.bold('NOT A DRY RUN!') +
      ' Waiting ' +
      time / 1000 +
      's for certainty. Use ctrl+c to bail'
    )
  },
  staging: () => 'Staging to target...',
  staged: ({ changes }) => (changes === 0 ? '(Empty)' : ''),
  unsetting: ({ field }) => 'Dropping ' + field + ' field from target',
  setting: ({ field }) => 'Updating ' + field + ' field on target',
  final: ({ target }) => {
    const dryRun = !target
    if (dryRun) return
    const { verlink, hashlink } = target
    return {
      output: 'print',
      success: Infinity, // omit success tick
      message:
        '\n' +
        ansi.green('Provisioned:') +
        '\n  Verlink: ' +
        ansi.green(verlink) +
        '\n\n  Hashlink: ' +
        ansi.gray(hashlink) +
        '\n'
    }
  },
  seeding: ({ cooloff, peers }) => {
    return (
      ansi.green(peers) + ' connected. Seeding until exit or inactive after ' + cooloff / 1000 + 's'
    )
  },
  inactive: () => 'Inactive, exiting'
})

module.exports = async function provision(cmd) {
  const ipc = context.getIPC()
  const { json, dryRun } = cmd.flags
  const sourceVerlink = cmd.args.sourceVerlink
  const targetLink = cmd.args.targetLink
  const productionVerlink = cmd.args.productionVerlink

  parse(sourceVerlink, '<source-verlink>')
  if (!dryRun) parse(targetLink, '<target-link>')
  parse(productionVerlink, '<production-verlink>')

  const final = await output(
    json,
    ipc.provision({ sourceVerlink, targetLink, productionVerlink, dryRun })
  )

  if (!json) {
    if (dryRun) {
      hint(
        'Dry run only — nothing was persisted. Once the diff looks right, properly provision with:',
        ['pear provision ' + sourceVerlink + ' ' + targetLink + ' ' + productionVerlink]
      )
    } else {
      hint('Keep the provisioned release available', ['pear seed ' + final.target.link])
      hint('Multisig for stakeholder-approved production', ['pear multisig keys get'])
    }
  }
}
