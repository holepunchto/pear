const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const harness = path.join(Helper.localDir, 'test', 'fixtures', 'harness')
const minimal = path.join(Helper.localDir, 'test', 'fixtures', 'minimal')

class Rig {
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    const helper = new Helper()

    this.helper = helper
    comment('connecting local sidecar')
    await helper.ready()
  }

  getOrCreateInfoInstance = async () => {
    if (this.pearInfoInstance) return this.pearInfoInstance

    const testId = Math.floor(Math.random() * 100000)
    const relativePath = path.relative(harness, minimal)
    const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
    const stager = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
    await stager.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

    for await (const line of stager.lineout) {
      const result = JSON.parse(line)
      if (result.tag === 'addendum') this.pearInfoInstance = result.data
      if (result.tag === 'final') break
    }

    await stager.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
    await stager.inspector.close()
    await stager.until.exit

    return this.pearInfoInstance
  }

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

// test.skip('pear run <relative-path> --updates-diff --no-updates') // TODO: after task Paparam flag relationships
// test.skip('pear run <relative-path> --tmp-store --store <path>') // TODO: after task Paparam flag relationships

test('pear info', async function ({ plan, is }) {
  plan(3)
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info']
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes('pear://')) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --json', async function ({ plan, alike, is }) {
  plan(1)
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--json']
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --changelog --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --changelog --metadata --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --changelog --key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --metadata --key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --changelog --metadata --key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --full-changelog <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --full-changelog --metadata --key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata --key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

// test.skip('pear info --full-changelog --changelog') // TODO: after task Paparam flag relationships

test('pear info --metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --metadata --key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', '--key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --metadata --key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', '--key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --changelog --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --changelog --metadata --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --changelog --key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --changelog --metadata --key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --changelog --metadata --key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--changelog', '--metadata', '--key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --full-changelog pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --full-changelog --metadata --key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --full-changelog --metadata --key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--full-changelog', '--metadata', '--key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --metadata --key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', '--key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --metadata --key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--metadata', '--key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --no-metadata --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-metadata', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-key --no-metadata <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--no-metadata', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-key --no-metadata --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--no-metadata', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --no-key <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)
  const { channel, link } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--no-key', channel, relativePath]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --no-key --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)
  const { channel } = await rig.getOrCreateInfoInstance()
  const relativePath = path.relative(harness, minimal)

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--no-key', '--json', channel, relativePath]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, true, 'should output the key as link')
  await running.until.exit
})

test('pear info --no-metadata --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-metadata', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'info', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'keys', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, true, 'should output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'info', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-key --no-metadata pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--no-metadata', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, true, 'should output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-key --no-metadata --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-key', '--no-metadata', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'changelog', 'final'], 'should output correct tags')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --no-key pear://<key>', async function ({ plan, is }) {
  plan(3)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--no-key', link]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let changelogPrinted = false
  let metadataPrinted = false
  let keyPrinted = false
  for await (const line of running.lineout) {
    if (line.includes('changelog')) changelogPrinted = true
    if (line.includes('info')) metadataPrinted = true
    if (line.includes(link)) keyPrinted = true
    if (line.endsWith('Success')) break
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(changelogPrinted, false, 'should not output the changelog')
  is(metadataPrinted, false, 'should not output the metadata')
  is(keyPrinted, false, 'should not output the key as link')
  await running.until.exit
})

test('pear info --no-changelog --no-metadata --no-key --json pear://<key>', async function ({ plan, alike, is }) {
  plan(1)
  const { link } = await rig.getOrCreateInfoInstance()

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['info', '--no-changelog', '--no-metadata', '--no-key', '--json', link]
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

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['retrieving', 'final'], 'should output correct tags')
  await running.until.exit
})

test('commands cleanup', rig.cleanup)
