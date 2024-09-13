const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')

global.Pear = {
  config: {
    args: [],
    applink: `file:///${os.cwd()}`
  }
}

const Helper = require('./helper')

const tmp = fs.realpathSync(os.tmpdir())

class Rig {
  setup = async () => {
    const helper = new Helper()
    this.helper = helper
    console.log('connecting local sidecar')
    await helper.ready()
    console.log('local sidecar connected')
    const id = Math.floor(Math.random() * 10000)
    console.log('staging platform...')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, dryRun: false, bare: true })
    await Helper.pick(staging, { tag: 'final' })
    console.log('platform staged')
    console.log('seeding platform...')
    const seeding = await helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, key: null, cmdArgs: [] })
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const key = await until.key
    await until.announced
    console.log('platform seeding')
    console.log('bootstrapping tmp platform...')
    const platformDir = path.join(tmp, 'tmp-pear')
    this.platformDir = platformDir
    await Helper.bootstrap(key, platformDir)
    console.log('tmp platform bootstrapped')
    Bare.prependListener('beforeExit', async () => {
      console.log('before rm', platformDir)
      await fs.promises.rm(platformDir, { recursive: true }).catch(() => {})
      console.log('after rm')
    }) // TODO simulate with Pear teadown or Helper.gc
  }

  cleanup = async () => {
    console.log('closing helper')
    await this.helper.close()
    console.log('closed helper')
  }
}

const rig = new Rig()

async function main () {
  await rig.setup()

  await rig.cleanup()
}

main()
  .then(() => console.log('done'))
  .catch((err) => console.error(err))
