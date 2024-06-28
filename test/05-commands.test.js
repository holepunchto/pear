const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const harness = path.join(Helper.root, 'test', 'fixtures', 'harness')
const minimal = path.join(Helper.root, 'test', 'fixtures', 'minimal')

class Rig {
  setup = async ({ comment }) => {
    this.helper = new Helper()
    comment('connecting local sidecar')
    await this.helper.ready()
    await this.helper.shutdown()
    this.helper = new Helper()
    await this.helper.ready()
    comment('local sidecar connected')
  }

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

test('pear stage --json <channel> <dir>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)

  const argv = ['stage', '--json', 'test-' + testId, minimal]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })

  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await running.inspector.close()
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'])
  const { code } = await running.until.exit
  is(code, 0)
})

test('commands cleanup', rig.cleanup)
