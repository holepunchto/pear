'use strict'
const { header, footer, command, flag, hiddenFlag, hiddenCommand, arg, summary, description, rest, bail } = require('paparam')
const { usage, print } = require('./iface')
const { CHECKOUT } = require('../constants')
const errors = require('../errors')
const rundef = require('../run/definition')
const runners = {
  init: require('./init'),
  stage: require('./stage'),
  seed: require('./seed'),
  release: require('./release'),
  info: require('./info'),
  dump: require('./dump'),
  shift: require('./shift'),
  sidecar: require('./sidecar'),
  gc: require('./gc'),
  run: require('./run'),
  encryptionKey: require('./encryption-key'),
  versions: require('./versions')
}

module.exports = async (ipc, argv = Bare.argv.slice(1)) => {
  await ipc.ready()
  Bare.prependListener('exit', () => { ipc.close() })

  const init = command(
    'init',
    summary('Create initial project files'),
    description('Template Types: desktop, terminal, terminal-node'),
    arg('[link|type]', 'Template link or type to init from. Default: desktop'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--yes|-y', 'Autoselect all defaults'),
    flag('--type|-t <type>', 'Project type: desktop (default) or terminal. Overrides: [link|type]'),
    flag('--force|-f', 'Force overwrite existing files'),
    flag('--with|-w [name]', 'Additional functionality. Available: node'),
    runners.init(ipc)
  )

  const dev = command(
    'dev',
    summary('Run a project in development mode'),
    description(usage.descriptions.dev),
    arg('[link|dir]', 'Source to run app from (default: .)'),
    rest('[...app-args]', 'Application arguments'),
    flag('--no-devtools', 'Open devtools with application [Desktop]'),
    flag('--no-updates-diff', 'Enable diff computation for Pear.updates'),
    flag('--no-updates', 'Disable updates firing via Pear.updates'),
    flag('--link <url>', 'Simulate deep-link click open'),
    flag('--store|-s <path>', 'Set the Application Storage path'),
    flag('--tmp-store|-t', 'Automatic new tmp folder as store path'),
    flag('--chrome-webrtc-internals', 'Enable chrome://webrtc-internals'),
    flag('--unsafe-clear-app-storage', 'Clear app storage'),
    flag('--unsafe-clear-preferences', 'Clear preferences (such as trustlist)'),
    flag('--appling <path>', 'Set application shell path'),
    flag('--checkout <n|release|staged>', 'Run a checkout from version length'),
    flag('--detached', 'Wakeup existing app or run detached'),
    hiddenFlag('--encryption-key <name>'), // internal temporarily
    hiddenFlag('--detach'),
    hiddenFlag('--trace <n>'),
    hiddenFlag('--swap <path>'),
    hiddenFlag('--start-id <id>'),
    hiddenFlag('--no-sandbox'), // electron passthrough
    (cmd) => runners.run(ipc)(cmd, true)
  )

  const seed = command(
    'seed',
    summary('Seed or reseed a project'),
    description(usage.descriptions.seed),
    arg('<channel|link>', 'Channel name or Pear link to seed'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--verbose|-v', 'Additional output'),
    flag('--seeders|-s ', 'Additional public keys to seed from'),
    flag('--name', 'Advanced. Override app name'),
    flag('--json', 'Newline delimited JSON output'),
    runners.seed(ipc)
  )

  const stage = command(
    'stage',
    summary('Synchronize local changes to key'),
    description(usage.descriptions.stage),
    arg('<channel|link>', 'Channel name or Pear link to stage'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--dry-run|-d', 'Execute a stage without writing'),
    flag('--bare|-b', 'File data only, no warmup optimization'),
    flag('--ignore <list>', 'Comma separated file path ignore list'),
    flag('--truncate <n>', 'Advanced. Truncate to version length n'),
    flag('--name', 'Advanced. Override app name'),
    flag('--json', 'Newline delimited JSON output'),
    hiddenFlag('--encryption-key <name>'), // internal temporarily
    runners.stage(ipc)
  )

  const release = command(
    'release',
    summary('Set production release version'),
    description(usage.descriptions.release),
    arg('<channel|link>', 'Channel name or Pear link to release'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--checkout <n>', 'Set release checkout n is version length'),
    flag('--json', 'Newline delimited JSON output'),
    runners.release(ipc)
  )

  const run = command(
    'run',
    summary('Run an application from a key or dir'),
    description(usage.descriptions.run),
    ...rundef,
    runners.run(ipc)
  )

  const info = command(
    'info',
    summary('Read project information'),
    arg('[link|channel]', 'Pear link or channel name to view info for'),
    arg('[dir]', 'Project directory path (default: .)'),
    description(usage.descriptions.info),
    flag('--changelog', 'View changelog only'),
    flag('--full-changelog', 'Full record of changes'),
    flag('--metadata', 'View metadata only'),
    flag('--key', 'View key only'),
    flag('--json', 'Newline delimited JSON output'),
    runners.info(ipc)
  )

  const dump = command(
    'dump',
    summary('Synchronize files from key to dir'),
    arg('<link>', 'Pear link to dump from, supports pathname'),
    arg('<dir>', 'Directory path to dump to, may be - for stdout'),
    flag('--checkout <n>', 'Dump from specified checkout, n is version length'),
    flag('--json', 'Newline delimited JSON output'),
    runners.dump(ipc)
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

  const sidecar = command(
    'sidecar',
    summary('Advanced. Run sidecar in terminal'),
    description(usage.descriptions.sidecar),
    flag('--verbose|-v', 'Additional output'),
    flag('--mem', 'memory mode: RAM corestore'),
    flag('--key <key>', 'Advanced. Switch release lines'),
    runners.sidecar(ipc)
  )

  const gc = command(
    'gc',
    summary('Advanced. Clear dangling resources'),
    command('releases', summary('Clear inactive releases'), (cmd) => runners.gc(ipc).releases(cmd)),
    command('sidecars', summary('Clear running sidecars'), (cmd) => runners.gc(ipc).sidecars(cmd)),
    flag('--json', 'Newline delimited JSON output'),
    () => { console.log(gc.help()) }
  )

  const versions = command(
    'versions',
    summary('View dependency versions'),
    flag('--json', 'JSON output'),
    runners.versions(ipc)
  )

  const help = command('help', arg('[command]'), summary('View help for command'), (h) => {
    if (h.args.command) console.log(cmd.help(h.args.command))
    else console.log(cmd.overview({ full: true }))
  })

  const encryptionKey = hiddenCommand(
    'encryption-key',
    command('add', arg('<name>'), arg('<secret>'), (cmd) => runners.encryptionKey(ipc).add(cmd)),
    command('remove', arg('<name>'), (cmd) => runners.encryptionKey(ipc).remove(cmd)),
    command('generate', (cmd) => runners.encryptionKey(ipc).generate(cmd))
  )

  const cmd = command('pear',
    flag('-v', 'Output version'),
    header(usage.header),
    init,
    dev,
    stage,
    seed,
    run,
    release,
    info,
    dump,
    shift,
    sidecar,
    gc,
    encryptionKey,
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
      console.log('Semver=' + semver)
      return
    }
    console.log(cmd.overview())
  }

  const program = cmd.parse(argv)
  if (program) program.running.finally(() => { ipc.close() })
  else ipc.close()

  function explain (bail) {
    if (bail.err) {
      const code = bail.err.code
      const known = errors.known('ERR_INVALID_').includes(code)
      if (known === false) {
        print(bail.reason, false)
        print(errors.ERR_UNKNOWN('Unknown [ code: ' + (bail.err.code || '(none)') + ' ] ' + bail.err.stack), false)
        Bare.exit(1)
      }
    }
    const reason = bail.reason === 'UNKNOWN_FLAG'
      ? 'Unrecognized Flag: --' + bail.flag.name
      : (bail.reason === 'UNKNOWN_ARG' ? 'Unrecognized Argument at index ' + bail.arg.index + ' with value' + bail.arg.value : bail.reason)

    print(reason, false)
    print('\n' + bail.command.usage())
  }

  return program
}
