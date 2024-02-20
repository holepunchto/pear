'use strict'
const Crank = require('../ipc/crank')
const init = require('./init')
const stage = require('./stage')
const seed = require('./seed')
const release = require('./release')
const info = require('./info')
const changelog = require('./changelog')
const dump = require('./dump')
const sidecar = require('./sidecar')
const run = require('./run')
const parse = require('../lib/parse')
const { CHECKOUT } = require('../lib/constants')

module.exports = async (channel) => {
  const ipc = new Crank(channel)
  Bare.prependListener('exit', () => { ipc.close() })
  const usage = require('./usage')(CHECKOUT)
  ipc.usage = usage
  const argv = Bare.argv.slice(1)
  const { _, version } = parse.args(argv, {
    boolean: ['help', 'version'],
    alias: { version: 'v', help: 'h' }
  })

  if (version) {
    usage.outputVersionBreakdown(argv.includes('--json'))
    Bare.exit(0)
  }

  if (_.length === 0) usage.output()

  class Cmd {
    constructor (help, teardown) {
      this.cmds = {}
      this.help = help
      this.teardown = teardown
    }

    add (cmd, fn) {
      this.cmds[cmd] = fn
    }

    async run (argv = Bare.argv) {
      const cmd = argv[0]
      const sub = `${cmd} ${argv[1]}`
      try {
        if (this.cmds[sub]) {
          if (argv.includes('--help') || argv.includes('-h')) return await this.help(sub)
          return await this.cmds[sub](argv.slice(2))
        }
        if (this.cmds[cmd]) {
          if (argv.includes('--help') || argv.includes('-h')) return await this.help(cmd)
          return await this.cmds[cmd](argv.slice(1))
        }
        return await this.help(cmd)
      } catch (err) {
        await this.teardown()
        throw err
      }
    }
  }

  const cmd = new Cmd(usage.output, () => { ipc.close() })
  cmd.add('help', ([cmd = 'full']) => usage.output(cmd[0] === '-' ? 'full' : cmd))
  cmd.add('versions', (args) => usage.outputVersions(args.includes('--json')))
  cmd.add('init', init(ipc))
  cmd.add('dev', (args) => run(ipc)(['--dev', ...args], true))
  cmd.add('stage', stage(ipc))
  cmd.add('seed', seed(ipc))
  cmd.add('release', release(ipc))
  cmd.add('run', launch)
  cmd.add('launch', launch) // launch is legacy alias for run
  cmd.add('info', info(ipc))
  cmd.add('dump', dump(ipc))
  cmd.add('build', build)
  cmd.add('sidecar', (args) => sidecar(ipc)(args))
  cmd.add('changelog', (args) => changelog(ipc)(args))

  await cmd.run(argv)

  function launch (args) {
    return run(ipc)(args)
  }

  function build () { throw new Error('Not Implemented: build') }

  return ipc
}
