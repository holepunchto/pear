'use strict'
const paparam = require('paparam')
const {
  header,
  footer,
  command,
  flag,
  arg,
  summary,
  description,
  bail,
  sloppy,
  rest,
  validate,
  hiddenCommand
} = paparam
const { usage, print, ansi, explain } = require('pear-terminal')
const { CHECKOUT } = require('pear-constants')
const opwait = require('pear-opwait')
const run = require('pear-run')
const pdump = require('pear-dump')
const { once } = require('bare-events')
const def = {
  run: require('pear-cmd/run'),
  pear: require('pear-cmd/pear')
}

class Plugin {
  constructor(link) {
    this.link = link
  }
  runner() {
    return async (cmd) => {
      const ipc = global.Pear[global.Pear.constructor.IPC]
      const { platform } = await ipc.versions()
      global.Pear.app.fork = platform.fork
      global.Pear.app.length = platform.length
      global.Pear.app.key = platform.key
      global.Pear.app.applink = 'pear://pear'
      Bare.argv.unshift('pear')
      const pipe = run(this.link, cmd.argv.slice(1))
      await once(pipe, 'end')
      await ipc.close()
    }
  }
  async definition(cmd) {
    const pkg = await opwait(pdump(this.link + '/package.json', { dir: '-' }))
    const definition = JSON.parse(pkg.value)?.pear?.platform?.command
    if (definition) cmd.add(definition)
  }
}

const commands = {
  init: require('./init'),
  stage: require('./stage'),
  seed: require('./seed'),
  provision: require('./provision'),
  release: require('./release'),
  info: require('./info'),
  dump: require('./dump'),
  touch: require('./touch'),
  data: require('./data'),
  changelog: require('./changelog'),
  shift: require('./shift'),
  drop: require('./drop'),
  sidecar: require('./sidecar'),
  gc: require('./gc'),
  run: require('./run'),
  versions: require('./versions'),
  presets: require('./presets')
}

module.exports = async (ipc, argv = Bare.argv.slice(1)) => {
  await ipc.ready()

  Bare.prependListener('exit', () => {
    ipc.close()
  })

  const init = command(
    'init',
    summary('Create initial project files'),
    description`
    Links:
      pear://electron/template
      ${ansi.italic(ansi.dim('pear://your.key.here/your/path/here'))}

    Names:
      default, ui, node-compat
    `,
    arg('[link|name]', 'Link or core template to init from'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--yes|-y', 'Autoselect all defaults'),
    flag('--force|-f', 'Force overwrite existing files'),
    flag('--no-ask', 'Suppress permission prompt'),
    commands.init
  )

  const dev = command('dev', sloppy({ args: true, flags: true }), () => {
    print('pear dev has been removed, use pear run --dev instead.', false)
    ipc.close()
  }).hide()

  const stage = command(
    'stage',
    summary('Synchronize local changes to link'),
    description`
      Stage local changes to a project link.

      Outputs diff information and project link.
    `,
    arg('<link>', 'Pear link to stage'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--dry-run|-d', 'Execute a stage without writing'),
    flag('--ignore <paths>', 'Comma-separated path ignore list'),
    flag('--purge', 'Remove ignored files if present in previous stage'),
    flag('--compact|-c', 'Tree-shaking minimal stage via static-analysis'),
    flag('--only <paths>', 'Filter by paths. Comma-separated'),
    flag('--truncate <n>', 'Advanced. Truncate to version length n'),
    flag('--name <name>', 'Advanced. Override app name'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--no-pre', 'Skip pre scripts'),
    flag('--pre-io', 'Show stdout & stderr of pre scripts'),
    flag('--pre-q', 'Suppress piped output of pre scripts'),
    flag('--json', 'Newline delimited JSON output'),
    commands.stage
  )

  const seed = command(
    'seed',
    summary('Seed or reseed a project'),
    description`
      Specify a link to seed a project.

      Specify a remote link to reseed.
    `,
    arg('<link>', 'Pear link to seed'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--verbose|-v', 'Additional output'),
    flag('--name <name>', 'Advanced. Override app name'),
    flag('--no-ask', 'Suppress permission prompt'),
    flag('--json', 'Newline delimited JSON output'),
    commands.seed
  )

  const provision = command(
    'provision',
    summary('Pre-production block sync'),
    description`
      Synchronize blocks to a pre-production target link

      The target can then be multi-signed against a production link

      Use pear touch to initialize target link
    `,
    arg('<source-link>', 'Versioned source link'),
    arg('<target-link>', 'Target link to sync to'),
    arg('<production-link>', 'Versioned link to sync against'),
    flag('--dry-run|-d', 'Execute provision without writing'),
    flag('--json', 'Newline delimited JSON output'),
    commands.provision
  )

  const release = command(
    'release',
    summary('Set release pointer'),
    description`
      Set the release pointer against a version (default latest).

      Use this to indicate production release points.
    `,
    arg('<link>', 'Pear link to release'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--checkout <n>', 'Set release checkout n is version length'),
    flag('--json', 'Newline delimited JSON output'),
    commands.release
  )

  const run = command(
    'run',
    summary('Run an application from a link or dir'),
    description`
      ${ansi.bold('link')}   pear://<key> | pear://<alias>
      ${ansi.bold('dir')}    file://<absolute-path> | <absolute-path> | <relative-path>
    `,
    ...def.run,
    commands.run
  )

  const info = command(
    'info',
    summary('View project information'),
    description`
      Supply a link to view application information.

      Supply no argument to view platform information.
    `,
    arg('[link]', 'Project to view info for'),
    arg('[dir]', 'Project directory path (default: .)'),
    flag('--changelog', 'View changelog only').hide(),
    flag('--full-changelog', 'Full record of changes').hide(),
    flag('--changelog-max <n>', 'Maximum changelog entries').hide(),
    flag('--metadata', 'View metadata only'),
    flag('--manifest', 'View app manifest only'),
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

  const touch = command(
    'touch',
    summary('Initialize project link'),
    description`Create a project Pear link if it doesn't already exist`,
    flag('--dir', 'Project dir-based deterministic touch'),
    flag('--json', 'Newline delimited JSON output'),
    commands.touch
  )

  const data = command(
    'data',
    summary('Explore platform database'),
    command('apps', summary('Installed apps'), arg('[link]', 'Filter by link'), (cmd) =>
      commands.data(cmd, 'apps')
    ),
    command('dht', summary('DHT known-nodes cache'), (cmd) => commands.data(cmd, 'dht')),
    command('gc', summary('Garbage collection records'), (cmd) => commands.data(cmd, 'gc')),
    command('manifest', summary('Database internal versioning'), (cmd) =>
      commands.data(cmd, 'manifest')
    ),
    command('assets', summary('On-disk assets for app'), arg('[link]', 'Filter by link'), (cmd) =>
      commands.data(cmd, 'assets')
    ),
    command(
      'currents',
      summary('Current working versions'),
      arg('[link]', 'Filter by link'),
      (cmd) => commands.data(cmd, 'currents')
    ),
    command(
      'presets',
      summary('Presets by link and command'),
      arg('[link]', 'Filter by link'),
      arg('[command]', 'Filter by command'),
      (cmd) => commands.data(cmd, 'presets')
    ),
    flag('--secrets', 'Show sensitive information'),
    flag('--json', 'Newline delimited JSON output'),
    () => {
      console.log(data.help())
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

  const shift = command(
    'shift',
    summary('Advanced. Move storage between apps'),
    arg('<source>', 'Source application Pear link'),
    arg('<destination>', 'Destination application Pear link'),
    flag('--force', 'Overwrite existing application storage if present'),
    flag('--json', 'Newline delimited JSON output'),
    commands.shift
  )

  const drop = command(
    'drop',
    summary('Advanced. Permanent data deletion'),
    command(
      'app',
      summary('Reset an application to initial state'),
      description('Clear application storage for supplied link.'),
      arg('<link>', 'Application link'),
      flag('--json', 'Newline delimited JSON output'),
      commands.drop
    ),
    () => {
      console.log(drop.help())
    }
  )

  const reset = hiddenCommand('reset', arg('[link]'), () => {
    console.log(`${ansi.warning} Deprecated. Use ${ansi.bold('pear drop app <link>')} instead.\n`)
    console.log(drop.help())
    Bare.exit(1)
  })

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
    command('releases', summary('Clear inactive releases'), commands.gc),
    command('sidecars', summary('Clear running sidecars'), commands.gc),
    command(
      'assets',
      summary('Clear synced assets'),
      arg('[link]', 'Clear asset by link'),
      commands.gc
    ),
    command('cores', summary('Clear corestore cores'), commands.gc),
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

  const presets = command(
    'presets',
    summary('Default flags per command & link'),
    description`
      Pin flags to a given pear command per app link
    `,
    arg('<command>', 'Command to apply default flags to'),
    arg('<link>', 'App link to apply default flags to'),
    flag('--json', 'Newline delimited JSON output'),
    rest('[...flags]', 'Default flags to set. Omit flags to reset'),
    sloppy({ flags: true }),
    commands.presets
  )

  const help = command('help', arg('[command]'), summary('View help for command'), (h) => {
    if (h.args.command) console.log(cmd.help(h.args.command))
    else console.log(cmd.overview({ full: true }))
  })

  const cmd = command(
    'pear',
    ...def.pear,
    header(usage.header),
    init,
    dev,
    run,
    stage,
    seed,
    provision,
    release,
    info,
    dump,
    touch,
    data,
    changelog,
    shift,
    drop,
    reset,
    sidecar,
    gc,
    versions,
    presets,
    help,
    footer(usage.footer),
    bail(explain),
    pear
  )

  function pear({ flags }) {
    if (flags.v) {
      const semver = require('../package.json').version
      if (flags.json) {
        const checkout = JSON.stringify(CHECKOUT)
        console.log({ ...checkout, semver })
        return
      }
      const { key, fork, length } = CHECKOUT

      console.log('v' + ~~fork + '.' + (length || 'dev') + '.' + key + ' / v' + semver + '\n')
      console.log('Key=' + key)
      console.log('Fork=' + fork)
      console.log('Length=' + length)
      console.log('SemVer=' + semver)
      return
    }
    console.log(cmd.overview())
  }

  const shell = require('pear-cmd')(argv)
  const cmdIx = shell?.indices.args.cmd ?? -1
  if (cmdIx > -1) argv = argv.slice(cmdIx)

  // support for `#!/usr/bin/env pear` in npm bin:
  if (shell?.positionals?.[0]?.includes('/node_modules/.bin/')) {
    argv[0] = 'run'
    argv.push('-f', shell.positionals[0])
  }
  run.argv = argv

  const preparse = cmd.parse(argv, { run: false, silent: true, bails: false })
  if (commands[cmd.current?.name] instanceof Plugin) {
    await commands[cmd.current.name].definition(cmd.current)
  }

  const presetsArgs = await getPresets(preparse)

  const args = [...argv.slice(0, 1), ...presetsArgs, ...argv.slice(1)]
  const program = cmd.parse(args)

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

async function getPresets(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  if (!cmd || !cmd.args.link) return []
  const command = cmd.name
  const link = cmd.args.link
  const presetsStream = await ipc.presets({ link, command })
  const { presets } = await opwait(presetsStream)
  return presets?.flags ? presets.flags.split(' ') : []
}
