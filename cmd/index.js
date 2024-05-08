'use strict'
const { header, footer, command, flag, hiddenFlag, arg, summary, description, rest, bail } = require('paparam')
const { usage, print } = require('./iface')
const { CHECKOUT } = require('../lib/constants')
const errors = require('../lib/errors')
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
  versions: require('./versions')
}

module.exports = async (ipc) => {
  Bare.prependListener('exit', () => { ipc.close() })

  const init = command(
    'init',
    summary('Create initial project files'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--yes|-y', 'Autoselect all defaults'),
    flag('--type|-t <type>', 'Project type: desktop (default) or terminal'),
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
    hiddenFlag('--detach'),
    hiddenFlag('--start-id'),
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
    flag('--ignore', 'Comma separated file path ignore list'),
    flag('--truncate <n>', 'Advanced. Truncate to version length n'),
    flag('--name', 'Advanced. Override app name'),
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
    ...require('../run/definition'),
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
    arg('<link>', 'Pear link to dump from'),
    arg('<dir>', 'Directory path to dump to'),
    flag('--checkout <n>', 'Dump from specified checkout n is version length'),
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
    description('Resource may be: sidecar'),
    arg('<resource>', 'Resource type to garbage collect'),
    flag('--json', 'Newline delimited JSON output'),
    runners.gc(ipc)
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
    versions,
    help,
    footer(usage.footer),
    bail(explain),
    pear
  )

  function pear ({ flags }) {
    if (flags.v) {
      if (flags.json) {
        console.log(JSON.stringify(CHECKOUT))
        return
      }
      let { key, fork, length } = CHECKOUT
      key += ''
      fork += ''
      length += ''
      let v = 'Key' + ' '.repeat(key.length) + 'Fork' + ' '.repeat(fork.length) + 'Length' + ' '.repeat(length.length) + '\n'
      v += key + '   ' + fork + '    ' + length
      console.log(v)

      return
    }
    console.log(cmd.overview())
  }

  const program = cmd.parse(Bare.argv.slice(1))
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

  return ipc
}
