'use strict'
const context = require('../context')
const { outputter, ansi, byteDiff, hint } = require('../lib/terminal.js')
const { ERR_INVALID_LINK } = require('pear-errors')
const plink = require('pear-link')

const output = outputter('provision', {
  ['byte-diff']: byteDiff,
  syncing: ({ type }) => 'Syncing existing ' + type + ', please wait...',
  blocks: ({ type, targetLength, productionLength }) => {
    return {
      output: 'status',
      message: 'Synced ' + type + ' blocks ' + targetLength + ' / ' + productionLength
    }
  },
  synced: ({ type }) => '\nCompleted ' + type + ' sync',
  diffing: () => 'Checking diff\n',
  diffed: ({ changes, semver, target }) => {
    const { core, blobs } = target
    return (
      'Diffing complete\nTotal changes: ' +
      changes +
      '\nPackage version: ' +
      semver +
      '\n\nCore:\n' +
      '  Key: ' +
      core.id +
      '\n  Length: ' +
      core.length +
      '\n  Hash: ' +
      core.hash +
      '\n\nBlobs:\n' +
      '  Key: ' +
      blobs.id +
      '\n  Length: ' +
      blobs.length +
      '\n  Hash: ' +
      blobs.hash +
      '\n'
    )
  },
  dry: () => 'Dry Run Complete\n',
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
      message: '\nProvisioned:\n  Verlink: ' + verlink + '\n\n  Hashlink: ' + hashlink + '\n'
    }
  },
  seeding: ({ cooloff, peers }) => {
    return peers + ' connected. Seeding until exit or inactive after ' + cooloff / 1000 + 's'
  },
  inactive: () => 'Inactive, exiting'
})

module.exports = async function provision(cmd) {
  const ipc = context.getIPC()
  const { json, dryRun } = cmd.flags
  const sourceVerlink = cmd.args.sourceVerlink
  const targetLink = cmd.args.targetLink
  const productionVerlink = cmd.args.productionVerlink

  const source = plink.parse(sourceVerlink)
  if (source.drive.length === null) {
    throw ERR_INVALID_LINK('<source-verlink> must be versioned', {
      link: sourceVerlink
    })
  }

  plink.parse(targetLink) // validates

  const production = plink.parse(productionVerlink)
  if (production.drive.length === null) {
    throw ERR_INVALID_LINK('<production-verlink> must be versioned', {
      link: productionVerlink
    })
  }
  const final = await output(
    json,
    ipc.provision({ sourceVerlink, targetLink, productionVerlink, dryRun })
  )

  if (!json) {
    if (dryRun) {
      hint('Dry run only - nothing was persisted. Once the diff looks right, provision for real:', [
        'pear provision ' + sourceVerlink + ' ' + targetLink + ' ' + productionVerlink
      ])
    } else if (final?.target) {
      hint('Keep the provisioned release available', ['pear seed <link>'])
      hint('Multisig for stakeholder-approved production', ['pear multisig keys get'])
    }
  }
}
