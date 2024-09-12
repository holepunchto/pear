const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fs = require('bare-fs')
const LocalDrive = require('localdrive')

const fixtures = path.join(Helper.root, 'test', 'fixtures')
const harness = path.join(fixtures, 'harness')
const minimal = path.join(fixtures, 'minimal')

class Rig {
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    const helper = new Helper()
    this.helper = helper
    comment('connecting local sidecar')
    await helper.ready()
  }

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shutdown')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

test('pear stage --dry-run <channel> <relative-path>', async function ({ is, timeout }) {
  timeout(600000)
  // eslint-disable-next-line no-unused-vars
  for (const i of Array(200).keys()) {
    // const testId = Math.floor(Math.random() * 100000)
    // const relativePath = path.relative(harness, minimal)
    const argv = ['info']

    const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
    await running.inspector.evaluate(`
        __PEAR_TEST__.command(${JSON.stringify(argv)})
    `, { returnByValue: false })

    // const completedStaging = false
    for await (const line of running.lineout) {
      // console.log(line)
      // if (line === 'Staging dry run complete!') completedStaging = true
      if (line.endsWith('Success')) break
    }
    // await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
    await running.inspector.close()

    // is(completedStaging, true, 'should complete staging')
    const { code } = await running.until.exit
    console.log('exit code returned in commands.test.js is', code)
    is(code, 0, 'should have exit code 0')
    if (code !== 0) break
  }
})

test('commands cleanup', rig.cleanup)
