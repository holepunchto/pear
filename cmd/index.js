'use strict'
const paparam = require('paparam')
const { header, footer, command, flag, arg, summary, description, bail, rest, validate } = paparam
const { usage, print, isTTY } = require('../lib/terminal.js')
const { cmdArgs } = require('../argv')
const errors = require('pear-errors')
const { definition } = require('../lib/cmd')
const { UPGRADE, PEAR_DEV_ROOT } = require('../constants.js')
const { runMenu } = require('bare-tui-paparam')

const commands = {
  touch: require('./touch'),
  stage: require('./stage'),
  build: require('pear-build'),
  seed: require('./seed'),
  provision: require('./provision'),
  multisig: require('./multisig'),
  info: require('./info'),
  dump: require('./dump'),
  install: require('pear-install/cmd').runner,
  data: require('./data'),
  changelog: require('./changelog'),
  sidecar: require('./sidecar'),
  gc: require('./gc'),
  cores: require('./cores'),
  versions: require('./versions'),
  blindPeer: require('./blind-peer')
}

module.exports = async (ipc, argv = cmdArgs) => {
  await ipc.ready()

  Bare.prependListener('exit', () => {
    ipc.close()
  })

  const touch = command(
    'touch',
    summary('Generate a project link'),
    description`Create a new randomly generated Pear link`,
    flag('--json', 'Newline delimited JSON output'),
    flag('--vanity <vanity>', 'Generate a link starting with this z32 prefix').hint(
      'Found by generating keys until one starts with what you asked for. More than 4 characters can take a very long time.'
    ),
    commands.touch
  )

  const seed = command(
    'seed',
    summary('Seed or reseed a project'),
    description`
      Announce a project link on the network and serve its blocks to peers.

      Runs until you exit, or until every --until-sync peer has fully synced.
    `,
    arg('<link>', 'Pear link to seed').hint(
      'Accepts a versioned verlink too, but only the key is used — seed always replicates the full/latest history, never pinned to that version.'
    ),
    flag('--no-tty', 'Print plain log lines instead of the live terminal UI').hint(
      'In the interactive form this appears as an unchecked "tty" box; checking it passes --no-tty and turns off the live UI.'
    ),
    flag(
      '--until-sync <key>',
      'Exit once this peer has synced. Pass multiple flags to wait for more peers'
    )
      .multiple()
      .hint(
        "A peer's public key (z32). The live view lists Seeding, Drive Key, Drive Length, Discovery Key, Content Key, Firewalled, NAT Type, Whoami and Network, then an unlabelled log below — the key to use here is the one printed after each peer join or peer sync line."
      ),
    flag('--stats-interval <milliseconds>', 'Stats refresh interval in milliseconds').hint(
      'Defaults to 500 milliseconds with the live UI on, or 3000 milliseconds under --no-tty.'
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.seed
  )

  const build = command('build', require('pear-build/package.json').command, async (cmd) => {
    const builder = commands.build(cmd.flags)
    // suppress error event as .done also rejects on error
    builder.on('error', () => {})
    await builder.done()
  })

  const stage = command(
    'stage',
    summary('Sync disk changes into project'),
    description`
      Stage local changes to a project link.

      Outputs diff information and the resulting project link.
    `,
    arg('<link>', 'Pear link to stage').hint(
      'If you pass a versioned verlink, only its key is used — staging always targets the current head, ignoring the version segment.'
    ),
    arg('[dir=.]', 'Project directory to stage from').hint(
      'Defaults to the directory you run the command from. If it has no package.json, Pear searches upward through parent directories for one.'
    ),
    flag('--dry-run|-d', 'Execute a stage without writing').hint(
      'Does not guard --truncate: if --truncate is also given, the drive is truncated for real before any dry-run check runs.'
    ),
    flag('--ignore <paths>', "Don't stage these comma-separated paths").hint(
      "Supports glob patterns (*, **) and a leading ! to un-ignore. Adds to — doesn't replace — any ignore list already set in pear.json."
    ),
    flag('--purge', 'Also delete already-staged files that now match the ignore list').hint(
      "Also switches on automatically if the project's pear.json sets stage.purge."
    ),
    flag('--only <paths>', 'Only stage these comma-separated paths').hint(
      "Matches by exact path/directory prefix, not glob patterns like --ignore. Adds to — doesn't replace — any stage.only list in pear.json."
    ),
    flag(
      '--truncate <n>',
      'Advanced. Truncate the project to this version length. Destructive — later versions are dropped'
    ).hint('n is the length segment of a verlink (pear://<fork>.<length>.<key>).'),
    flag('--json', 'Newline delimited JSON output'),
    commands.stage
  )

  const provision = command(
    'provision',
    summary('Block-sync source & production'),
    description`
      Synchronize blocks from a source link to a pre-production target link.

      The target can then be multisig'd against a production link.

      Use pear touch to generate the target link first.
    `,
    arg('<source-verlink>', 'Versioned source link').hint(
      'Must carry a version — pear://<fork>.<length>.<key>. A bare link is rejected, because it always resolves to the latest content instead of pinning one.'
    ),
    arg('<target-link>', 'Target link to sync to, as generated by pear touch'),
    arg('<production-verlink>', 'Versioned production link to sync against').hint(
      'Must carry a version — pear://<fork>.<length>.<key>. A bare link is rejected, because it always resolves to the latest content instead of pinning one.'
    ),
    flag('--dry-run|-d', 'Execute provision to a disposable target').hint(
      'Downloads and diffs against a temporary local drive instead of the real target — nothing reaches the target link itself, and no swarm announce happens for it. The temporary drive is deleted afterward.'
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.provision
  )

  const multisig = command(
    'multisig',
    summary('Production signing coordination'),
    description`
      Quorum-based cryptographic cosigning for production releases.

      Gather enough signatures to approve a release to synchronize
      onto a production link.

      Example - 2/3 must sign to approve
      pear.json: {
        "multisig": {
          "publicKeys": ["<pubkey1>", "<pubkey2>", "<pubkey3>"],
          "namespace": "my-org/my-app",
          "quorum": 2
        }
      }
    `,
    command(
      'keys',
      summary('Manage signing keys'),
      command(
        'get',
        summary('Get signing key, initializing if needed'),
        description`
          Idempotent.

          Creates a public/private keypair if one doesn't already exist.

          Always prints the public key.
        `,
        arg(
          '[name=default]',
          'Key identifier for the keypair\'s on-disk names. Defaults to "default"'
        ).hint('Must match ^[\\w-]+$ — letters, numbers, hyphens, underscores only.'),
        flag(
          '--secret',
          'Also print the private key in plain text — make sure nobody can see your screen'
        ),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'paths',
        summary('Print paths to public & private key files'),
        arg(
          '[name=default]',
          'Key identifier for the keypair\'s on-disk names. Defaults to "default"'
        ).hint(
          'Prints the path unconditionally — it never checks that a key by this name was actually created.'
        ),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'list',
        summary('List signing keys'),
        description`
          Output all names and public keys
        `,
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'add',
        summary('Add signing keys'),
        description`
          Import a signing keypair or add a known public key
        `,
        arg('<name>', 'Name to store this key under. Must not already exist'),
        arg('<public-key>', 'Public key — a key path or key string').hint(
          "Must be z32-encoded (the same format pear multisig keys get prints), whether given as a literal string or a file's contents."
        ),
        arg(
          '[private-key]',
          'Private key — a key path or key string. A path avoids leaving it in shell history. Omit for public-key only'
        ),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'remove',
        summary('Remove signing keys'),
        arg('<name>', 'Name of the key to remove. Permanent — no confirmation, no backup').hint(
          'Deletes both the public key file and, if present, the private key file.'
        ),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      (cmd) => console.log(cmd.command.help())
    ),
    command(
      'link',
      summary('Print project multisig link'),
      description`
        The multisig link is derived from the publicKeys, quorum and
        namespace fields of your project's pear.json.

        Run pear help multisig for an example config.
      `,
      flag(
        '--config [./pear.json]',
        "Path to the project's pear.json. Defaults to ./pear.json"
      ).hint('Needs a multisig field with publicKeys, quorum and namespace.'),
      flag('--vanity <vanity>', 'Generate a link starting with this z32 prefix').hint(
        'Found by generating keys until one starts with what you asked for. More than 4 characters can take a very long time.'
      ),
      flag('--json', 'Newline delimited JSON output'),
      commands.multisig
    ),
    command(
      'request',
      summary('Create a multisig request'),
      description`
        Create a signing request to synchronize a versioned source link
        onto the project's multisig link, as printed by pear multisig link.
      `,
      flag('--force', 'Skip sanity checks').hint(
        "Skips verifying that the source drive's db and blobs cores are reachable and fully seeded at the requested version — omit it and this step can block or fail if the source isn't well seeded."
      ),
      flag(
        '--config [./pear.json]',
        "Path to the project's pear.json. Defaults to ./pear.json"
      ).hint('Needs a multisig field with publicKeys, quorum and namespace.'),
      flag(
        '--peer-update-timeout <milliseconds>',
        'How long to wait for peers to update, in milliseconds'
      ).hint(
        'Defaults to 5000 milliseconds. Only matters when --force is not set — it bounds the checks that --force skips entirely.'
      ),
      flag('--json', 'Newline delimited JSON output'),
      arg('<verlink>', 'Versioned source link to sign off').hint(
        'A verlink pins an exact version — pear://<fork>.<length>.<key> — unlike a bare link, which always resolves to the latest content.'
      ),
      commands.multisig
    ),
    command(
      'sign',
      summary('Sign a multisig request'),
      description`
        Sign a multisig request using a local signing key.

        The key's public counterpart must be listed in the
        multisig.publicKeys field of the pear.json at the source link
        supplied to pear multisig request.
      `,
      arg('<request>', 'As returned by pear multisig request').hint(
        "Must be the z32-encoded request string, unmodified — it's decoded and structurally validated before signing, so a truncated or edited request is rejected immediately."
      ),
      arg('[name=default]', 'Local key to sign with, by name. Defaults to "default"').hint(
        "Selects the encrypted private key file created by pear multisig keys get <name>. You'll be prompted for the exact password used when that key was generated — there's no recovery if you forget it."
      ),
      flag('--json', 'Newline delimited JSON output'),
      commands.multisig
    ),
    command(
      'verify',
      summary('Verify multisig request & responses'),
      description('Verify inputs and perform a commit dry run'),
      flag('--force-dangerous', 'Advanced. Careful, this may break the core').hide(),
      flag(
        '--config [./pear.json]',
        "Path to the project's pear.json. Defaults to ./pear.json"
      ).hint('Needs a multisig field with publicKeys, quorum and namespace.'),
      flag(
        '--peer-update-timeout <milliseconds>',
        'How long to wait for peers to update, in milliseconds'
      ).hint(
        'Defaults to 5000 milliseconds. verify always runs as a dry-run, so it never reaches the separate unbounded post-commit seeding wait.'
      ),
      flag('--json', 'Newline delimited JSON output'),
      arg('<source-link>', 'Source pear link').hint(
        'The original (non-multisig) versioned link, not the multisig link.'
      ),
      arg('<request>', 'Signing request, as printed by pear multisig request'),
      rest('[...responses]', 'Signing responses, as printed by pear multisig sign').hint(
        'One response per signer who has run pear multisig sign — collect them all before verifying.'
      ),
      commands.multisig
    ),
    command(
      'commit',
      summary('Commit multisig to go live'),
      description('Apply signatures to allow sync from source drive to multisig drive'),
      flag(
        '--config [./pear.json]',
        "Path to the project's pear.json. Defaults to ./pear.json"
      ).hint('Needs a multisig field with publicKeys, quorum and namespace.'),
      flag('--force-dangerous', 'Advanced. Careful, this may break the core').hide(),
      flag(
        '--peer-update-timeout <milliseconds>',
        'How long to wait for peers to update, in milliseconds'
      ).hint(
        'Defaults to 5000 milliseconds, and bounds only the checks that run before the commit. The wait for remote seeders afterwards takes no timeout at all and can block indefinitely — on any commit, not just the first. Ctrl-C is the only way out.'
      ),
      flag('--json', 'Newline delimited JSON output'),
      arg('<source-link>', 'Source pear link').hint(
        'The original (non-multisig) versioned link, not the multisig link.'
      ),
      arg('<request>', 'Signing request, as printed by pear multisig request'),
      rest('[...responses]', 'Signing responses, as printed by pear multisig sign').hint(
        'One response per signer who has run pear multisig sign — collect them all before committing.'
      ),
      commands.multisig
    ),
    (cmd) => console.log(cmd.command.help())
  )

  const info = command(
    'info',
    summary('View project information'),
    description`
      View information about a project.

      Supply a link to inspect a specific project, or omit it to view
      platform information.
    `,
    arg('[link]', 'Project to view info for').hint(
      'Must be a pear:// link with a drive key — file: URLs and local directory paths (which dump accepts) are rejected.'
    ),
    arg('[dir=.]', 'Project directory path').hint(
      'Currently has no effect on the output — info never reads this value; it only inspects the given link, or platform info when none is given.'
    ),
    flag('--changelog', 'View changelog only').hide(),
    flag('--full-changelog', 'Full record of changes').hide(),
    flag('--changelog-max <n>', 'Maximum changelog entries').hide(),
    flag('--metadata', 'Print the project metadata').hint(
      'Selects sections along with --key and --multisig; whichever you name, only those print, and metadata prints between them. --manifest is different: it prints the manifest and stops, so pairing it with --metadata gives you the manifest and nothing else.'
    ),
    flag('--manifest', 'Print the app manifest').hint(
      'Not a section selector like --key, --metadata and --multisig — it prints the manifest and stops there. Pair it with --key and the key still prints first; pair it with --metadata or --multisig and you get the manifest alone.'
    ),
    flag('--multisig', 'Print the multisig quorum and signing keys').hint(
      'Selects sections along with --key and --metadata; whichever you name, only those print, and multisig prints last. --manifest is different: it prints the manifest and stops, so pairing it with --multisig gives you the manifest and nothing else.'
    ),
    flag('--key', 'Print the view key').hint(
      'Selects sections along with --metadata and --multisig; whichever you name, only those print, and the key prints first. --manifest is different: it prints the manifest and stops, but the key still appears above it.'
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.info
  )

  const dump = command(
    'dump',
    summary('Synchronize files from a link to a directory'),
    arg('<link>', 'Link to dump from. May be file:, pear: or dir').hint(
      'A pear:// link, a file: URL, or a plain local directory path.'
    ),
    arg('[dir]', 'Directory path to dump to. Use - for output-only').hint(
      'Use - instead of a path to print to stdout rather than writing files.'
    ),
    flag('--dry-run|-d', 'Preview without writing any changes').hint(
      'No effect when <dir> is - or --list is set — those modes only read and print, so there is nothing being written to skip.'
    ),
    flag('--checkout <n>', 'Dump the project as it was at this version length').hint(
      'n is the length segment of a verlink (pear://<fork>.<length>.<key>).'
    ),
    flag('--only <paths>', 'Only dump these comma-separated paths').hint(
      'Passing this alone still deletes matched files in <dir> that no longer exist at <link> — add --no-prune too if you want to filter without removing anything.'
    ),
    flag('--force|-f', 'Force overwrite existing files').hint(
      'Only matters if <dir> already has files in it — an empty or not-yet-created <dir> never needs this.'
    ),
    flag('--list', 'List the paths inside the link instead of writing any files').hint(
      '<dir> is ignored when this is set — it always prints instead of writing.'
    ),
    flag('--no-prune', 'Keep destination files that are missing from the source').hint(
      'Pruning is on unless you set this, so a plain dump deletes anything in <dir> that is not at <link>. No effect when <dir> is - or --list is set — those modes only read and print, so nothing is ever deleted either way.'
    ),
    flag('--json', 'Newline delimited JSON output'),
    validate((cmd) => {
      if (cmd.flags.list) cmd.args.dir = '-'
      return true
    }),
    validate('<dir> is required', (cmd) => !!cmd.args.dir), // TODO fix in paparam
    commands.dump
  )

  const install = command(
    'install',
    arg('<link>', 'Pear link origin to install from').hint(
      'Must be a bare pear:// origin link with no path segment — a link pointing at a sub-path inside the drive is rejected.'
    ),
    require('pear-install/package.json').command,
    commands.install
  )

  const data = command(
    'data',
    summary('Explore platform database'),
    command('dht', summary('DHT known-nodes cache'), commands.data).hint(
      'Lists nodes this platform has already discovered. Distributed Hash Table, the peer-discovery network Pear nodes use to find each other.'
    ),
    command('multisig', summary('Multisig records'), commands.data),
    flag('--json', 'Newline delimited JSON output'),
    (cmd) => {
      console.log(cmd.command.help())
    }
  )

  const changelog = command(
    'changelog',
    summary('View project changelog'),
    description`
      View a project's changelog.

      Supply a link to inspect a specific project, or omit it to view
      Pear's own changelog.
    `,
    arg('[link]', 'Project to view changelog of').hint(
      'Must be a pear:// link that resolves to a real drive key — a local directory path or file: URL is rejected here, unlike pear dump.'
    ),
    flag('--max|-m <n=10>', 'Maximum number of entries to show').hint(
      'Must be a whole number. Also ignored when --full is set, which shows every matching entry regardless of this limit.'
    ),
    flag(
      '--of <semver=^*>',
      'Only show entries matching this semver range. Default: latest major'
    ).hint(
      'Accepts npm-style semver range syntax — e.g. ^2.0.0, ~1.4.0, 1.x.x, *, or multiple ranges joined with ||.'
    ),
    flag('--full', 'Show entire changelog').hint(
      "Also changes what 'entire' means: with no --of override, every version in the file is included, not just the latest major."
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.changelog
  )

  const sidecar = command(
    'sidecar',
    command('shutdown', commands.sidecar, summary('Shutdown running sidecar')),
    command('inspect', commands.sidecar, summary('Enable running sidecar inspector')).hint(
      'Opens the sidecar for remote debugging via Chrome DevTools. The inspector key it prints must be kept secret.'
    ),
    summary('Advanced. Run sidecar in terminal'),
    description`
      The sidecar is a local IPC server that brokers corestore access
      for every running Pear app.

      Running pear sidecar shuts down any existing sidecar and takes
      over as the new one, staying attached to this terminal.
    `,
    flag('--log-level <level>', 'Verbosity to log at — 0=off, 1=error, 2=info, or 3=trace').hint(
      'Case-insensitive. Also accepts the 3-letter form, e.g. INF.'
    ),
    flag('--dht-bootstrap <nodes>').hide(),
    commands.sidecar
  )

  const blindPeer = command(
    'blind-peer',
    summary('Manage blind peers'),
    command(
      'start',
      summary('Start a blind peer'),
      flag('--trusted-peer <peer>', 'Trusted peer key to allow requests from').multiple(),
      commands.blindPeer
    ),
    command('identity', summary('Show peer identity key'), commands.blindPeer),
    command(
      'request',
      summary('Request a blind peer to seed'),
      arg('<key>', 'Corestore key to be seeded'),
      flag('--peer <peer>', 'Peer key to request from'),
      commands.blindPeer
    ),
    flag('--json', 'Newline delimited JSON output'),
    () => {
      console.log(blindPeer.help())
    }
  )

  const gc = command(
    'gc',
    summary('Advanced. Clear dangling resources'),
    command(
      'cores',
      summary('Clear corestore cores'),
      flag('--force|-f', 'Clear writable cores without confirmation'),
      arg('<link|name>', 'Clear the cores belonging to this link or app name').hint(
        "Clears this link's core, then its content core if the first one cleared. A core you can write to, or one the local corestore has never seen, is skipped rather than treated as an error — the output says which."
      ),
      commands.gc
    ).hint(
      "A core is a single append-only log in Pear's local corestore. This deletes the blocks one core has stored on disk, freeing that space; the core itself stays in the corestore."
    ),
    flag('--json', 'Newline delimited JSON output'),
    () => {
      console.log(gc.help())
    }
  )

  const cores = command(
    'cores',
    summary('List platform cores'),
    description`
      Lists the cores in the platform corestore.
      Empty cores are omitted unless --all-cores is set.
    `,
    flag('--all-cores', 'List all cores, including empty cores').hint(
      'An empty core has been allocated but never written to.'
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.cores
  )

  const versions = command(
    'versions',
    summary('View dependency versions'),
    flag('--modules|-m', 'Include module versions').hint(
      "Lists every package in Pear's own bundled dependencies (bare-*, hypercore-*, corestore, etc.) — not the dependencies of your own project."
    ),
    flag('--json', 'Newline delimited JSON output'),
    commands.versions
  )

  const help = command(
    'help',
    arg('[command]', 'Command to show help for. Omit to show the full overview'),
    summary('View help for command'),
    (h) => {
      if (h.args.command) console.log(cmd.help(h.args.command))
      else console.log(cmd.overview({ full: true }))
    }
  )

  const cmd = command(
    'pear',
    ...definition,
    header(usage.header),
    touch,
    seed,
    stage,
    build,
    provision,
    multisig,
    info,
    dump,
    install,
    data,
    changelog,
    sidecar,
    blindPeer,
    gc,
    cores,
    versions,
    help,
    footer(usage.footer),
    bail(function explain(bail = {}) {
      if (!bail.reason && bail.err) {
        const known = errors.known()
        if (known.includes(bail.err.code) === false) {
          print(
            errors.ERR_UNKNOWN(
              'Unknown [ code: ' + (bail.err.code || '(none)') + ' ] ' + bail.err.stack
            ),
            false
          )
          Bare.exit(1)
        }
      }
      const messageUsage = (bail) => bail.err.message
      const messageOnly = (bail) => bail.err.message
      const opFail = (cmd) => cmd.err.info.message
      const codemap = new Map([
        ['UNKNOWN_FLAG', (bail) => 'Unrecognized Flag: --' + bail.flag.name],
        [
          'UNKNOWN_ARG',
          (bail) =>
            'Unrecognized Argument at index ' + bail.arg.index + ' with value ' + bail.arg.value
        ],
        ['MISSING_ARG', (bail) => bail.arg.value],
        ['INVALID', messageUsage],
        ['ERR_INVALID_INPUT', messageUsage],
        ['ERR_LEGACY', messageOnly],
        ['ERR_INVALID_TEMPLATE', messageOnly],
        ['ERR_INVALID_PROJECT_DIR', messageOnly],
        ['ERR_DIR_NONEMPTY', messageOnly],
        ['ERR_NOT_FOUND', messageOnly],
        ['ERR_OPERATION_FAILED', opFail]
      ])
      const nouse = [messageOnly, opFail]
      const subcode = bail.err?.code === 'ERR_OPERATION_FAILED' ? bail.err?.info?.code : null
      const code = codemap.has(subcode ?? bail.err?.code) ? (subcode ?? bail.err.code) : bail.reason
      const ref = codemap.get(code)
      let reason = bail.reason
      if (codemap.has(code)) {
        reason = subcode ? bail.err?.info?.message : (codemap.get(code)(bail) ?? bail.reason)
      }
      Bare.exitCode = 1

      if (argv.includes('--json')) {
        console.log(
          JSON.stringify({
            cmd: argv[0],
            tag: 'error',
            data: {
              success: false,
              code,
              message: reason
            }
          })
        )
        return
      }

      print(reason, false)

      if (nouse.some((fn) => fn === ref) || codemap.has(code) === false) return

      print('\n' + bail.command.usage())
    }),
    pear
  )

  async function pear({ flags }) {
    if (flags.v) {
      const pkg = require('../package.json')
      const { version } = pkg
      const devRoot = PEAR_DEV_ROOT
      const vinfo = await ipc.versions()
      const key = vinfo?.platform?.key || UPGRADE
      const fork = devRoot ? null : (vinfo?.platform?.fork ?? null)
      const length = devRoot ? null : (vinfo?.platform?.length ?? null)
      const hasVersioned = fork !== null && length !== null
      const versionedKey = hasVersioned ? `pear://${fork}.${length}.${stripPearPrefix(key)}` : key
      if (flags.json) {
        console.log(
          JSON.stringify({ key, version, path: devRoot, fork: fork, length, versionedKey })
        )
        return
      }
      console.log(versionedKey + ' / v' + version + '\n')

      if (devRoot) console.log('Path=' + devRoot)
      else console.log('Key=' + key)
      console.log('SemVer=' + version)
      if (fork !== null) console.log('Fork=' + fork)
      if (length !== null) console.log('Length=' + length)
      return
    }
    console.log(cmd.overview())
  }

  function stripPearPrefix(link) {
    if (typeof link !== 'string') return ''
    return link.startsWith('pear://') ? link.slice('pear://'.length) : link
  }

  const shell = require('../lib/cmd').command(argv)
  const cmdIx = shell?.indices.args.cmd ?? -1

  let program = null

  if (shell?.flags?.menu) {
    if (!isTTY) {
      print('pear --menu requires an interactive terminal', false)
      Bare.exitCode = 1
      ipc.close()
      return null
    }
    const confirmed = await runMenu(cmd, {
      onComplete: (result, { argv: menuArgv }) => {
        program = cmd.parse(menuArgv)
      }
    })
    if (!confirmed || !confirmed.run) {
      ipc.close()
      return null
    }
  } else {
    if (cmdIx > -1) argv = argv.slice(cmdIx)

    if (argv[0] === 'run') {
      const message =
        'pear run has been removed.\nUse the pear-runtime module instead: https://www.npmjs.com/package/pear-runtime'
      print(message, false)
      Bare.exitCode = 1
      ipc.close()
      return null
    }

    program = cmd.parse(argv)
  }

  if (program === null) {
    ipc.close()
    return null
  }

  if (program.running) {
    program.running.finally(() => {
      ipc.close()
    })
  }

  return program
}
