'use strict'
const { header, footer, command, flag, arg, summary, description, bail, sloppy } = require('paparam')
const { usage, print, ansi } = require('pear-api/terminal')
const { CHECKOUT } = require('pear-api/constants')
const errors = require('pear-api/errors')
const def = {
  run: require('pear-api/cmd/run'),
  pear: require('pear-api/cmd/pear')
}
const runners = {
  init: require('./init'),
  stage: require('./stage'),
  seed: require('./seed'),
  release: require('./release'),
  info: require('./info'),
  dump: require('./dump'),
  touch: require('./touch'),
  shift: require('./shift'),
  reset: require('./reset'),
  sidecar: require('./sidecar'),
  gc: require('./gc'),
  run: require('./run'),
  versions: require('./versions'),
  data: require('./data')
}

module.exports = async (ipc, argv = Bare.argv.slice(1)) => {
  await ipc.ready()
  Bare.prependListener('exit', () => { ipc.close() })

  const init = command(
    'init',
    summary('Create initial project files'),
    description('Template Types: desktop, terminal, terminal-node'),
    arg('<link|type=desktop>', 'Link or type to init from.'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--yes|-y', 'Autoselect all defaults'),
    flag('--type|-t <type>', 'Template type. Overrides <link|type>'),
    flag('--force|-f', 'Force overwrite existing files'),
    flag('--with|-w <name>', 'Additional functionality. Available: node'),
    flag('--no-ask', 'Suppress permissions dialogs'),
    runners.init(ipc)
  )

  const dev = command(
    'dev',
    sloppy({ args: true, flags: true }),
    () => {
      print('pear dev has been deprecated, use pear run --dev instead.', false)
      ipc.close()
    }
  ).hide()

  const seed = command(
    'seed',
    summary('Seed or reseed a project'),
    description `
      Specify channel or key to seed a project.

      Specify a remote key to reseed.
    `,
    arg('<channel|link>', 'Channel name or Pear link to seed'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--verbose|-v', 'Additional output'),
    flag('--seeders|-s ', 'Additional public keys to seed from'),
    flag('--name <name>', 'Advanced. Override app name'),
    flag('--no-ask', 'Suppress permissions dialogs'),
    flag('--json', 'Newline delimited JSON output'),
    runners.seed(ipc)
  )

  const stage = command(
    'stage',
    summary('Synchronize local changes to key'),
    description `
      Channel name must be specified on first stage,
      in order to generate the initial key.

      Outputs diff information and project key.
    `,
    arg('<channel|link>', 'Channel name or Pear link to stage'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--dry-run|-d', 'Execute a stage without writing'),
    flag('--ignore <list>', 'Comma separated file path ignore list'),
    flag('--truncate <n>', 'Advanced. Truncate to version length n'),
    flag('--name <name>', 'Advanced. Override app name'),
    flag('--json', 'Newline delimited JSON output'),
    flag('--no-ask', 'Suppress permissions dialogs'),
    runners.stage(ipc)
  )

  const release = command(
    'release',
    summary('Set production release version'),
    description `
      Set the release pointer against a version (default latest).

      Use this to indicate production release points.
    `,
    arg('<channel|link>', 'Channel name or Pear link to release'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--checkout <n>', 'Set release checkout n is version length'),
    flag('--json', 'Newline delimited JSON output'),
    runners.release(ipc)
  )

  const run = command(
    'run',
    summary('Run an application from a key or dir'),
    description `
      ${ansi.bold('link')}   pear://<key> | pear://<alias>
      ${ansi.bold('dir')}    file://<absolute-path> | <absolute-path> | <relative-path>
    `,
    ...def.run,
    runners.run(ipc)
  )

  const info = command(
    'info',
    summary('View project information'),
    description `
      Supply a key or channel to view application information.

      Supply no argument to view platform information.
    `,
    arg('[link|channel]', 'Pear link or channel name to view info for'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--changelog', 'View changelog only'),
    flag('--full-changelog', 'Full record of changes'),
    flag('--metadata', 'View metadata only'),
    flag('--key', 'View key only'),
    flag('--json', 'Newline delimited JSON output'),
    flag('--no-ask', 'Suppress permissions dialogs'),
    runners.info(ipc)
  )

  const dump = command(
    'dump',
    summary('Synchronize files from key to dir'),
    arg('<link>', 'Link to dump from. May be file:, pear: or dir'),
    arg('<dir>', 'Directory path to dump to, may be - for stdout'),
    flag('--dry-run|-d', 'Execute a dump without writing'),
    flag('--checkout <n>', 'Dump from specified checkout, n is version length'),
    flag('--json', 'Newline delimited JSON output'),
    flag('--force|-f', 'Force overwrite existing files'),
    flag('--no-ask', 'Suppress permissions dialogs'),
    runners.dump(ipc)
  )

  const touch = command(
    'touch',
    summary('Ensure Pear link'),
    description(`Initialize a project Pear link if it doesn't already exist.`),
    arg('[channel]', 'Channel name. Default: randomly generated'),
    flag('--json', 'Newline delimited JSON output'),
    runners.touch(ipc)
  )

  const shift = command(
    'shift',
    summary('Advanced. Move storage between apps'),
    arg('<source>', 'Source application Pear link'),
    arg('<destination>', 'Destination application Pear link'),
    flag('--force', 'Overwrite existing application storage if present'),
    flag('--json', 'Newline delimited JSON output'),
    runners.shift(ipc)
  )

  const reset = command(
    'reset',
    summary('Advanced. Reset an application to initial state'),
    description('Clear application storage for supplied link.'),
    arg('<link>', 'Application link'),
    flag('--json', 'Newline delimited JSON output'),
    runners.reset(ipc)
  )

  const sidecar = command(
    'sidecar',
    summary('Advanced. Run sidecar in terminal'),
    description `
      The Pear Sidecar is a local-running HTTP and IPC server which
      provides access to corestores.

      This command instructs any existing sidecar process to shutdown
      and then becomes the sidecar.
    `,
    command('shutdown', runners.sidecar(ipc), summary('Shutdown running sidecar')),
    flag('--mem', 'Memory mode: RAM corestore'),
    flag('--key <key>', 'Advanced. Switch release lines'),
    flag('--log-level <level>', 'Level to log at. 0,1,2,3 (OFF,ERR,INF,TRC)'),
    flag('--log-labels <list>', 'Labels to log (internal, always logged)'),
    flag('--log-fields <list>', 'Show/hide: date,time,h:level,h:label,h:delta'),
    flag('--log-stacks', 'Add a stack trace to each log message'),
    flag('--dht-bootstrap <nodes>').hide(),
    runners.sidecar(ipc)
  )

  const gc = command(
    'gc',
    summary('Advanced. Clear dangling resources'),
    command('releases', summary('Clear inactive releases'), (cmd) => runners.gc(ipc).releases(cmd)),
    command('sidecars', summary('Clear running sidecars'), (cmd) => runners.gc(ipc).sidecars(cmd)),
    command('interfaces', flag('--age ms', 'GC if mtime exceeds. Default 2.592e9ms (30 days)'), summary('Clear unused interfaces'), (cmd) => runners.gc(ipc).interfaces(cmd)),
    flag('--json', 'Newline delimited JSON output'),
    () => { console.log(gc.help()) }
  )

  const versions = command(
    'versions',
    summary('View dependency versions'),
    flag('--json', 'Newline delimited JSON output'),
    runners.versions(ipc)
  )

  const data = command(
    'data',
    summary('Explore platform database'),
    command('apps', summary('Installed apps'), arg('[link]', 'Filter by link'), (cmd) => runners.data(ipc).apps(cmd)),
    command('dht', summary('DHT known-nodes cache'), (cmd) => runners.data(ipc).dht(cmd)),
    command('gc', summary('Garbage collection records'), (cmd) => runners.data(ipc).gc(cmd)),
    flag('--secrets', 'Show sensitive information, i.e. encryption-keys'),
    flag('--json', 'Newline delimited JSON output'),
    () => { console.log(data.help()) }
  )

  const help = command('help', arg('[command]'), summary('View help for command'), (h) => {
    if (h.args.command) console.log(cmd.help(h.args.command))
    else console.log(cmd.overview({ full: true }))
  })

  const cmd = command('pear',
    ...def.pear,
    header(usage.header),
    init,
    dev,
    stage,
    seed,
    run,
    release,
    info,
    dump,
    touch,
    data,
    shift,
    reset,
    sidecar,
    gc,
    versions,
    help,
    footer(usage.footer),
    bail(explain),
    pear
  )

  function pear ({ flags }) {
    if (flags.v) {
      const semver = require('../package.json').version
      if (flags.json) {
        const checkout = JSON.stringify(CHECKOUT)
        console.log({ ...checkout, semver })
        return
      }
      const { key, fork, length } = CHECKOUT

      console.log('v' + ~~(fork) + '.' + (length || 'dev') + '.' + key + ' / v' + semver + '\n')
      console.log('Key=' + key)
      console.log('Fork=' + fork)
      console.log('Length=' + length)
      console.log('SemVer=' + semver)
      return
    }
    console.log(cmd.overview())
  }

  const shell = require('pear-api/cmd')(argv)
  const cmdIx = shell?.indices.args.cmd ?? -1
  if (cmdIx > -1) argv = argv.slice(cmdIx)

  // support for `#!/usr/bin/env pear` in npm bin:
  const [ positional ] = shell.positionals
  if (positional?.includes('/node_modules/.bin/')) {
    argv[0] = 'run'
    argv.push('-f', positional)
  }
  run.argv = argv

  const program = cmd.parse(argv)

  if (program === null) {
    ipc.close()
    return null
  }

  if (program.running) program.running.finally(() => { ipc.close() })

  return program

  function explain (bail) {
    if (bail.err) {
      const code = bail.err.code
      const known = errors.known('ERR_INVALID_', 'ERR_OPERATION_FAILED', 'ERR_DIR_NONEMPTY')
      if (known.includes(code) === false) {
        print(bail.reason, false)
        print(errors.ERR_UNKNOWN('Unknown [ code: ' + (bail.err.code || '(none)') + ' ] ' + bail.err.stack), false)
        Bare.exit(1)
      }
    }
    const reason = bail.reason === 'UNKNOWN_FLAG'
      ? 'Unrecognized Flag: --' + bail.flag.name
      : (bail.reason === 'UNKNOWN_ARG' ? 'Unrecognized Argument at index ' + bail.arg.index + ' with value "' + bail.arg.value + '"' : bail.reason)

    print(reason, false)
    print('\n' + bail.command.usage())
  }
}
