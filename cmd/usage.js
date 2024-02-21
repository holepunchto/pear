'use strict'
const { ansi, print, stdio } = require('./iface')
let usage = null
module.exports = ({ fork, length, key }) => {
  if (usage) return usage

  const v = `${fork || 0}.${length || 'dev'}.${key}`

  const version = ansi.bold(ansi.gray('v' + v))
  const name = 'Pear'
  const cmd = name.toLowerCase()
  const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
  const init = ansi.bold(cmd + ' init')
  const initArgs = ansi.bold('[dir]')
  const initBrief = 'Create initial project files.'
  const initExplain = `${init} ${initArgs}

    ${initBrief}

    --yes|-y         Autoselect all defaults
    --type|-t=type   Project type: desktop (default) or terminal
    --force|-f       Force overwrite existing files
    --with|-w=name   Additional functionality. Available: node
  `
  const dev = ansi.bold(cmd + ' dev')
  const devArgs = ansi.bold('[dir] [...args]')
  const devBrief = 'Run a project in development mode.'
  const devExplain = `${dev} ${devArgs}

    ${devBrief}
    Alias for: ${ansi.italic('pear run --dev <dir>')}

    --link=url                 Simulate deep-link click open
    --store|-s=path            Set the Application Storage path
    --tmp-store|-t             Automatic new tmp folder as store path
  `

  const stage = ansi.bold(cmd + ' stage')
  const stageArgs = ansi.bold('<channel|key> [dir]')
  const stageBrief = 'Synchronize local changes to key.'
  const stageExplain = `${stage} ${stageArgs}

    ${stageBrief}

    Channel name must be specified on first stage,
    in order to generate the initial key.

    Outputs diff information and project key.

    --json         Newline delimited JSON output
    --dry-run|-d   Execute a stage without writing
    --bare|-b      File data only, no warmup optimization
    --ignore       Comma separated file path ignore list
    --name         Advanced. Override app name
  `
  const release = ansi.bold(cmd + ' release')
  const releaseArgs = ansi.bold('<channel|key>')
  const releaseBrief = 'Set production release version.'
  const releaseExplain = `${release} ${releaseArgs}

    ${releaseBrief}

    Set the release pointer against a version (default latest).

    Use this to indicate production release points.

    --json           Newline delimited JSON output
    --checkout=n     Set a checkout, n is version length
  `

  const info = ansi.bold(cmd + ' info')
  const infoArgs = ansi.bold('[key]')
  const infoBrief = 'Read project information.'
  const infoExplain = `${info} ${infoArgs}
    
    ${infoBrief}

    Supply a key to view application info

    Without a key pear info shows Pear info

    --json          Newline delimited JSON output
  `

  const dump = ansi.bold(cmd + ' dump')
  const dumpArgs = ansi.bold('<key> <dir>')
  const dumpBrief = 'Synchronize files from key to dir.'
  const dumpExplain = `${dump} ${dumpArgs}

    ${dumpBrief}

    --json          Newline delimited JSON output
    --checkout=n    Dump from a specific checkout, n is version length
  `

  const run = ansi.bold(cmd + ' run')
  const runArgs = ansi.bold('<key|dir|alias> [...args]')
  const runBrief = 'Run an application from a key or dir.'
  const runExplain = `${run} ${runArgs}

    ${runBrief}

    ${ansi.bold('key')}    pear://<key>
    ${ansi.bold('dir')}    file://<absolute-path> | <absolute-path> | <relative-path>
    ${ansi.bold('alias')}  pear://<alias>

    --dev                      Run the app in dev mode
    --link=url                 Simulate deep-link click open
    --store|-s=path            Set the Application Storage path
    --tmp-store|-t             Automatic new tmp folder as store path
    --checkout=n               Run a checkout, n is version length
    --checkout=release         Run checkout from marked released length
    --checkout=staged          Run checkout from latest version length
    ${ansi.dim(ansi.italic(`
     pear run pear://u6c6it1hhb5serppr3tghdm96j1gprtesygejzhmhnk5xsse8kmy
     pear run pear://keet
     pear run file://path/to/an-app-folder
     pear run path/to/an-app-folder --some args
     `))}`

  const seed = ansi.bold(cmd + ' seed')
  const seedArgs = ansi.bold('<channel|key> [dir]')
  const seedBrief = 'Seed project or reseed key.'
  const seedExplain = `${seed} ${seedArgs}

    ${seedBrief}

    Specify channel or key to seed a project.

    Specify a remote key to reseed.

    --json        Newline delimited JSON output
    --seeders|-s  Additional public keys to seed from
    --name        Advanced. Override app name
    --verbose|-v  Additional output
  `

  const sidecar = ansi.bold(cmd + ' sidecar')
  const sidecarBrief = 'Advanced. Run sidecar in terminal.'
  const sidecarExplain = `${sidecar}

    The ${name} Sidecar is a local-running HTTP and IPC server which
    provides access to corestores.

    This command instructs any existing sidecar process to shutdown
    and then becomes the sidecar.

    --mem              memory mode: RAM corestore
    --attach-boot-io   include initial sidecar I/O (if applicable)
  `

  const versions = ansi.bold(cmd + ' versions')
  const versionsBrief = 'Output version information.'
  const versionsExplain = `${versions}

    ${versionsBrief}

    --json        Single JSON object
  `

  const help = ansi.bold(cmd + ' help')
  const helpArgs = ansi.bold('[cmd]')
  const helpBrief = `Run ${ansi.bold('pear help')} to output full help for all commands`
  const helpExplain = `${help} ${helpArgs} ${ansi.green(ansi.dim('~'))} ${ansi.bold(ansi.italic('pear [cmd] [--help|-h]'))}
    ${ansi.italic(cmd + ' help dev')}, ${ansi.italic(cmd + ' run -h')}, ${ansi.italic(cmd + ' seed --help')}
    ${helpBrief}
  `

  const url = ansi.link('https://holepunch.to')

  const header = `
  ${banner}
  ${ansi.pear + ' '}${version}
  `

  const miniHeader = `
  ${`${ansi.bold(name)} ~ ${ansi.dim(`«{${v}}» ${ansi.pear}`)}`}`

  const dedot = (str) => str.slice(0, -1)

  const footer = `  ${ansi.pear + ' '}${version}
  ${ansi.bold(ansi.dim(name))} ~ ${ansi.dim('Welcome to the IoP')}
  ${url}
  `

  usage = {
    banner,
    header,
    miniHeader,
    v,
    url,
    versions: versionsExplain,
    init: initExplain,
    dev: devExplain,
    stage: stageExplain,
    release: releaseExplain,
    info: infoExplain,
    dump: dumpExplain,
    run: runExplain,
    seed: seedExplain,
    sidecar: sidecarExplain,
    help: helpExplain,
    output,
    outputVersions,
    outputVersionBreakdown,
    min: `${init} ${ansi.sep} ${dedot(initBrief)}
    ${dev} ${ansi.sep} ${dedot(devBrief)}
    ${stage} ${ansi.sep} ${dedot(stageBrief)}
    ${seed} ${ansi.sep} ${dedot(seedBrief)}
    ${run} ${ansi.sep} ${dedot(runBrief)}
    ${release} ${ansi.sep} ${dedot(releaseBrief)}
    ${info} ${ansi.sep} ${dedot(infoBrief)}
    ${dump} ${ansi.sep} ${dedot(dumpBrief)}
    ${sidecar} ${ansi.sep} ${dedot(sidecarBrief)}
    ${versions} ${ansi.sep} ${dedot(versionsBrief)}

    ${helpExplain}
${footer}`,
    full: `${initExplain}
    ${devExplain}
    ${stageExplain}
    ${seedExplain}
    ${runExplain}
    ${releaseExplain}
    ${infoExplain}
    ${dumpExplain}
    ${sidecarExplain}
    ${versionsExplain}
    ${helpExplain}
${footer}`
  }

  function output (cmd = 'min', exit = true) {
    print(usage.header)
    if (!usage[cmd]) {
      stdio.out.write('  ')
      print('No help for "' + cmd + '" found\n', false)
    } else print('    ' + usage[cmd])
    if (exit) Bare.exit()
  }

  function outputVersionBreakdown (json) {
    if (json) {
      print(JSON.stringify({ key, fork, length }))
      return
    }
    key += ''
    fork += ''
    length += ''
    let result = 'Key' + ' '.repeat(key.length) + 'Fork' + ' '.repeat(fork.length) + 'Length' + ' '.repeat(length.length) + '\n'
    result += key + '   ' + fork + '    ' + length
    print(result)
  }

  function outputVersions (json) {
    const { dependencies } = require('../package.json')
    if (json) {
      print(JSON.stringify({
        pear: usage.v,
        ...Bare.versions,
        ...dependencies
      }, 0, 2))
      return
    }
    print(usage.banner + '\n')
    print(`${ansi.bold(cmd)}: ${usage.v}`)
    for (const [name, version] of Object.entries(Bare.versions)) print(`${ansi.bold(name)}: ${version}`)

    for (const [name, version] of Object.entries(dependencies)) print(`${ansi.bold(name)}: ${version}`)
  }

  return usage
}
