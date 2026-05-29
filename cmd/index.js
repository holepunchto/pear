'use strict'
const paparam = require('paparam')
const { header, footer, command, flag, arg, summary, description, bail, rest, validate } = paparam
const { usage, print } = require('../lib/terminal.js')
const path = require('bare-path')
const process = require('bare-process')
const { cmdArgs } = require('../argv')
const errors = require('pear-errors')
const def = {
  pear: require('pear-cmd/pear')
}

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
  versions: require('./versions')
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
    commands.touch
  )

  const seed = command(
    'seed',
    summary('Seed or reseed a project'),
    description`
      Specify a link to seed a project.
    `,
    arg('<link>', 'Pear link to seed'),
    flag('--no-tty', 'Disable tty features'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--stats-interval <ms>', 'Stats refresh interval in milliseconds'),
    flag('--json', 'Newline delimited JSON output'),
    commands.seed
  )

  const build = command('build', require('pear-build/package.json').command, (cmd) => {
    if (!cmd.flags.package) return console.log(build.help())
    return commands.build(cmd.flags).done()
  })

  const stage = command(
    'stage',
    summary('Sync disk changes into project'),
    description`
      Stage local changes to a project link.

      Outputs diff information and project link.
    `,
    arg('<link>', 'Pear link to stage'),
    arg('[dir=.]', 'Project directory path'),
    flag('--dry-run|-d', 'Execute a stage without writing'),
    flag('--ignore <paths>', 'Comma-separated path ignore list'),
    flag('--purge', 'Remove ignored files if present in previous stage'),
    flag('--only <paths>', 'Filter by paths. Comma-separated'),
    flag('--truncate <n>', 'Advanced. Truncate to version length n'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--json', 'Newline delimited JSON output'),
    commands.stage
  )

  const provision = command(
    'provision',
    summary('Block-sync source & production'),
    description`
      Synchronize blocks to a pre-production target link

      The target can then be multisig'd against a production link

      Use pear touch to generate target link
    `,
    arg('<source-verlink>', 'Versioned source link'),
    arg('<target-link>', 'Target link to sync to'),
    arg('<production-verlink>', 'Versioned link to sync against'),
    flag('--dry-run|-d', 'Execute provision without writing'),
    flag('--json', 'Newline delimited JSON output'),
    commands.provision
  )

  const multisig = command(
    'multisig',
    summary('Production signing coordination'),
    description`
      Quorum-based cryptographic cosigning for production releases

      Gather enough signatures to approve a release to synchronize
      onto a production link

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
          
          Creates public/private keypair if it doesn't exist.
          
          Always prints the public key
        `,
        arg('[name=default]', 'As used for public/private key filenames'),
        flag('--secret', 'Also output the private key'),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'paths',
        summary('Print paths to public & private key files'),
        arg('[name=default]', 'As used for public/private key filenames'),
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
        arg('<name>', 'As used for public/private key filenames'),
        arg('<public-key>', 'public key path or string'),
        arg('[private-key]', 'private key path or string'),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      command(
        'remove',
        summary('Remove signing keys'),
        arg('<name>', 'As used for public/private key filenames'),
        flag('--json', 'Newline delimited JSON output'),
        commands.multisig
      ),
      (cmd) => console.log(cmd.command.help())
    ),
    command(
      'link',
      summary('Print project multisig link'),
      description`
        The publicKeys, quorum & namespace values of the pear.json
        multisig field determine the multisig link

        Example - 2/3 must sign to approve
        pear.json: {
          "multisig": {
            "publicKeys": ["<pubkey1>", "<pubkey2>", "<pubkey3>"],
            "namespace": "my-org/my-app",
            "quorum": 2
          }
        }`,
      flag('--config [./pear.json]', 'Config file path'),
      flag('--json', 'Newline delimited JSON output'),
      commands.multisig
    ),
    command(
      'request',
      summary('Create a multisig request'),
      description`
        Create a signing request to synchronize from a versioned source link
        onto the project multisig link as output by the pear multisig link command
      `,
      flag('--force', 'Skip sanity checks'),
      flag('--config [./pear.json]', 'Config file path'),
      flag('--peer-update-timeout <ms>', 'Peer update timeout in ms'),
      flag('--json', 'Newline delimited JSON output'),
      arg('<verlink>', 'Versioned source link to sign off'),
      commands.multisig
    ),
    command(
      'sign',
      summary('Sign a multisig request'),
      description`
        Sign a multisig request using a local signing key

        The key's public counterpart must be listed in multisig.publicKeys
        in the pear.json of the source link supplied to pear multisig request
      `,
      arg('<request>', 'As returned by pear multisig request'),
      arg('[name=default]', 'Name of local key to sign with'),
      flag('--json', 'Newline delimited JSON output'),
      commands.multisig
    ),
    command(
      'verify',
      summary('Verify multisig request & responses'),
      description('Verify inputs & peform commit dry-run'),
      flag('--force-dangerous', 'Advanced. Careful, this may break the core').hide(),
      flag('--config [./pear.json]', 'Config file path'),
      flag('--peer-update-timeout <ms>', 'Peer update timeout in ms'),
      flag('--json', 'Newline delimited JSON output'),
      arg('<source-link>', 'Source pear link'),
      arg('<request>', 'Signing request'),
      rest('[...responses]', 'Signing responses'),
      commands.multisig
    ),
    command(
      'commit',
      summary('Commit multisig to go live'),
      description('Apply signatures to allow sync from source drive to multisig drive'),
      flag('--config [./pear.json]', 'Config file path'),
      flag('--force-dangerous', 'Advanced. Careful, this may break the core').hide(),
      flag('--peer-update-timeout <ms>', 'Peer update timeout in ms'),
      flag('--json', 'Newline delimited JSON output'),
      arg('<source-link>', 'Source pear link'),
      arg('<request>', 'Signing request'),
      rest('[...responses]', 'Signing responses'),
      commands.multisig
    ),
    (cmd) => console.log(cmd.command.help())
  )

  const info = command(
    'info',
    summary('View project information'),
    description`
      Supply a link to view application information.

      Supply no argument to view platform information.
    `,
    arg('[link]', 'Project to view info for'),
    arg('[dir=.]', 'Project directory path'),
    flag('--changelog', 'View changelog only').hide(),
    flag('--full-changelog', 'Full record of changes').hide(),
    flag('--changelog-max <n>', 'Maximum changelog entries').hide(),
    flag('--metadata', 'View metadata only'),
    flag('--manifest', 'View app manifest only'),
    flag('--multisig', 'View multisig info only'),
    flag('--key', 'View key only'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--json', 'Newline delimited JSON output'),
    commands.info
  )

  const dump = command(
    'dump',
    summary('Synchronize files from link to dir'),
    arg('<link>', 'Link to dump from. May be file:, pear: or dir'),
    arg('<dir>', 'Directory path to dump to. Use - for output-only'),
    flag('--dry-run|-d', 'Execute a dump without writing'),
    flag('--checkout <n>', 'Dump from specified checkout, n is version length'),
    flag('--only <paths>', 'Filter by paths. Implies --no-prune. Comma-seperated'),
    flag('--force|-f', 'Force overwrite existing files'),
    flag('--list', 'List paths at link. Sets <dir> to -'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--no-prune', 'Prevent removal of existing paths'),
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
    arg('<link>', 'Pear link origin to install from'),
    require('pear-install/package.json').command,
    commands.install
  )

  const data = command(
    'data',
    summary('Explore platform database'),
    command('dht', summary('DHT known-nodes cache'), commands.data),
    command('multisig', summary('Multisig records'), commands.data),
    flag('--secrets', 'Show sensitive information'),
    flag('--json', 'Newline delimited JSON output'),
    (cmd) => {
      console.log(cmd.command.help())
    }
  )

  const changelog = command(
    'changelog',
    summary('View project changelog'),
    description`
      Supply a link to view application changelog

      Shows Pear changelog by default
    `,
    arg('[link]', 'Project to view changelog of'),
    flag('--max|-m <n=10>', 'Maximum entries to show'),
    flag('--of <semver=^*>', 'SemVer filter - default: latest major'),
    flag('--full', 'Show entire changelog'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--json', 'Newline delimited JSON output'),
    commands.changelog
  )

  const sidecar = command(
    'sidecar',
    command('shutdown', commands.sidecar, summary('Shutdown running sidecar')),
    command('inspect', commands.sidecar, summary('Enable running sidecar inspector')),
    summary('Advanced. Run sidecar in terminal'),
    description`
      The sidecar is a local-running IPC server for corestore access.

      The pear sidecar command shuts down any existing sidecar process
      and then becomes the sidecar.
    `,
    command('shutdown', commands.sidecar, summary('Shutdown running sidecar')),
    flag('--mem', 'Memory mode: RAM corestore'),
    flag('--key <key>', 'Advanced. Switch release lines'),
    flag('--log-level <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
    flag('--log-labels <list>', 'Labels to log (internal, always logged)'),
    flag('--log-fields <list>', 'Show/hide: date,time,h:level,h:label,h:delta'),
    flag('--log-stacks', 'Add a stack trace to each log message'),
    flag('--dht-bootstrap <nodes>').hide(),
    commands.sidecar
  )

  const gc = command(
    'gc',
    summary('Advanced. Clear dangling resources'),
    command('sidecars', summary('Clear running sidecars'), commands.gc),
    command(
      'cores',
      summary('Clear corestore cores'),
      arg('[link]', 'Clear cores by link'),
      commands.gc
    ),
    flag('--json', 'Newline delimited JSON output'),
    () => {
      console.log(gc.help())
    }
  )

  const versions = command(
    'versions',
    summary('View dependency versions'),
    flag('--modules|-m', 'Include module versions'),
    flag('--json', 'Newline delimited JSON output'),
    commands.versions
  )

  const help = command('help', arg('[command]'), summary('View help for command'), (h) => {
    if (h.args.command) console.log(cmd.help(h.args.command))
    else console.log(cmd.overview({ full: true }))
  })

  const cmd = command(
    'pear',
    ...def.pear,
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
    gc,
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
        ['ERR_DIR_NONEMPTY', messageOnly],
        ['ERR_OPERATION_FAILED', opFail]
      ])
      const nouse = [messageOnly, opFail]
      const code = codemap.has(bail.err?.code) ? bail.err.code : bail.reason
      const ref = codemap.get(code)
      const reason = codemap.has(code) ? (codemap.get(code)(bail) ?? bail.reason) : bail.reason
      Bare.exitCode = 1

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
      const devRoot = getDevRoot()
      const vinfo = await ipc.versions()
      const key = vinfo?.platform?.key || pkg.upgrade
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

  function getDevRoot() {
    if (global.__PEAR_DEV_ROOT) return global.__PEAR_DEV_ROOT
    const execPath = process.execPath
    if (!execPath) return null
    const normalized = execPath.replace(/\\/g, '/')
    const ix = normalized.indexOf('/by-arch/')
    if (ix === -1) return null
    const root = normalized.slice(0, ix)
    if (!root) return null
    try {
      return path.resolve(root)
    } catch {
      return root
    }
  }

  const shell = require('pear-cmd')(argv)
  const cmdIx = shell?.indices.args.cmd ?? -1
  if (cmdIx > -1) argv = argv.slice(cmdIx)

  if (argv[0] === 'run') {
    const message =
      'pear run has been removed.\nUse the pear-runtime module instead: https://www.npmjs.com/package/pear-runtime'
    print(message, false)
    Bare.exitCode = 1
    ipc.close()
    return null
  }

  const program = cmd.parse(argv)

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
