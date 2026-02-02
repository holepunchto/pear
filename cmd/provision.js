'use strict'
const { outputter, byteDiff } = require('pear-terminal')
const { ERR_INVALID_LINK } = require('pear-errors')
const plink = require('pear-link')

const output = outputter('provision', {
  ['byte-diff']: byteDiff,
  syncing: ({ type }) => 'Syncing existing ' + type + ', please wait...',
  blocks: ({ type, targetLength, productionLength }) => {
    return {
      output: 'status',
      message:
        'Synced ' + type + ' blocks ' + targetLength + ' / ' + productionLength
    }
  },
  synced: ({ type }) => '\nCompleted ' + type + ' sync',
  diffing: () => 'Checking diff\n',
  diffed: ({ changes, semver, core, blobs }) => {
    return (
      '\nDiffing complete\nTotal changes: ' +
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
    'NOT A DRY RUN! Waiting ' +
      time / 1000 +
      's for certainty\nUse ctrl+c to bail'
  },
  staging: () => 'Staging to target...',
  staged: ({ changes }) => (changes === 0 ? '(Empty)' : ''),
  unsetting: ({ field }) => 'Dropping ' + field + ' field from target',
  setting: ({ field }) => 'Updating ' + field + ' field on target',
  final: ({ verlink, hashlink, link }) => {
    return {
      output: 'print',
      success: Infinity, // omit success tick
      message:
        '\nProvisioned:\n  Verlink: ' +
        verlink +
        '\n\n  Hashlink: ' +
        hashlink +
        '\n\nSeed with:\n\n   pear seed ' +
        link +
        '\n'
    }
  },
  seeding: ({ cooloff, peers }) => {
    return (
      peers +
      ' connected. Seeding until exit or inactive after ' +
      cooloff / 1000 +
      's'
    )
  },
  inactive: () => 'Inactive, exiting'
})

module.exports = async function provision(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, dryRun } = cmd.flags
  const sourceLink = cmd.args.sourceLink
  const targetLink = cmd.args.targetLink
  const productionLink = cmd.args.productionLink

  const source = plink.parse(sourceLink)
  if (source.drive.length === null) {
    throw ERR_INVALID_LINK('<source-link> must be versioned', {
      link: sourceLink
    })
  }

  plink.parse(targetLink) // validates

  const production = plink.parse(productionLink)
  if (production.drive.length === null) {
    throw ERR_INVALID_LINK('<target-link> must be versioned', {
      link: productionLink
    })
  }
  await output(
    json,
    ipc.provision({ sourceLink, targetLink, productionLink, dryRun })
  )
}
