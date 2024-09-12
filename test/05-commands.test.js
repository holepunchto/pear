const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const harness = path.join(Helper.root, 'test', 'fixtures', 'harness')
const minimal = path.join(Helper.root, 'test', 'fixtures', 'minimal')

class Rig {
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    this.platformDir = path.join(Helper.root, 'pear')
    const helper = new Helper({ platformDir: this.platformDir })

    this.helper = helper
    comment('connecting local sidecar')
    await helper.ready()
  }

  getOrCreateInfoInstance = async () => {
    if (this.pearInfoInstance) return this.pearInfoInstance

    const testId = Math.floor(Math.random() * 100000)
    const relativePath = path.relative(harness, minimal)
    const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
    const stager = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

test.todo('pear stage <channel> <absolute-path>')
test.todo('pear stage <channel> <relative-path>')
test.todo('pear stage <channel> <relative-path> (package.json pear.config.stage.entrypoints <relative-paths>)')
test.todo('pear stage <channel> <relative-path> (package.json pear.config.stage.ignore <relative-paths>)')
test.todo('pear stage --json <channel> <relative-path>')
test.todo('pear stage --dry-run <channel> <relative-path>')
test.todo('pear stage --dry-run --json <channel> <relative-path>')
test.todo('pear stage --bare <channel> <relative-path>')
test.todo('pear stage --bare --json <channel> <relative-path>')
test.todo('pear stage --ignore <list> <channel> <relative-path>')
test.todo('pear stage --ignore <list> --json <channel> <relative-path>')
test.todo('pear stage --truncate <n> <channel> <relative-path>')
test.todo('pear stage --truncate <n> --json <channel> <relative-path>')
test.todo('pear stage --name <name> <channel> <relative-path>')
test.todo('pear stage --name <name> --json <channel> <relative-path>')
test.todo('pear stage --ignore <list> --name <name> <channel> <relative-path>')
test.todo('pear stage --ignore <list> --name <name> --json <channel> <relative-path>')
test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> <channel> <relative-path>')
test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json <channel> <relative-path>')
test.todo('pear stage pear://<key>')
test.todo('pear stage --json pear://<key>')
test.todo('pear stage --dry-run pear://<key>')
test.todo('pear stage --dry-run --json pear://<key>')
test.todo('pear stage --bare pear://<key>')
test.todo('pear stage --bare --json pear://<key>')
test.todo('pear stage --ignore <list> pear://<key>')
test.todo('pear stage --ignore <list> --json pear://<key>')
test.todo('pear stage --truncate <n> pear://<key>')
test.todo('pear stage --truncate <n> --json pear://<key>')
test.todo('pear stage --name <name> pear://<key>')
test.todo('pear stage --name <name> --json pear://<key>')
test.todo('pear stage --ignore <list> --name <name> pear://<key>')
test.todo('pear stage --ignore <list> --name <name> --json pear://<key>')
test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> pear://<key>')
test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json pear://<key>')

test.todo('pear seed <channel> <absolute-path>')
test.todo('pear seed <channel> <relative-path>')
test.todo('pear seed --json <channel> <relative-path>')
test.todo('pear seed --seeders <key> <channel> <relative-path>')
test.todo('pear seed --seeders <key> --json <channel> <relative-path>')
test.todo('pear seed --name <name> <channel> <relative-path>')
test.todo('pear seed --name <name> --json <channel> <relative-path>')
test.todo('pear seed pear://<key>')
test.todo('pear seed --json pear://<key>')
test.todo('pear seed --seeders <key> pear://<key>')
test.todo('pear seed --seeders <key> --json pear://<key>')
test.todo('pear seed --name <name> pear://<key>')
test.todo('pear seed --name <name> --json pear://<key>')

test.todo('pear run <absolute-path>')
test.todo('pear run <relative-path>')
test.todo('pear run <relative-path> --tmp-store')
test.todo('pear run <relative-path> --store <relative-path>')
test.todo('pear run <relative-path> --store <absolute-path>')
test.todo('pear run <relative-path> --unsafe-clear-app-storage')
test.todo('pear run <relative-path> --unsafe-clear-preferences')
test.todo('pear run file:///<absolute-path>')
test.todo('pear run pear://<key>')
test.todo('pear run pear://<key>/<entrypoint>')
test.todo('pear run pear://<key> --store <path>')
test.todo('pear run pear://<key> --tmp-store')
test.todo('pear run pear://<key> --unsafe-clear-app-storage')
test.todo('pear run pear://<key> --unsafe-clear-preferences')

test.todo('pear run <relative-path> (package.json pear.config.previewFor <key>)')
test.todo('pear run <relative-path> (package.json pear.config.links <keys>)')
test.todo('pear run <relative-path> (package.json pear.config.links <hosts>)')
test.todo('pear run <relative-path> (package.json pear.config.type <terminal | desktop>)')
test.todo('pear run <relative-path> --updates-diff')
test.todo('pear run <relative-path> --no-updates')
test.todo('pear run <relative-path> --link <url>')
// test.skip('pear run <relative-path> --updates-diff --no-updates') // TODO: after task Paparam flag relationships
// test.skip('pear run <relative-path> --tmp-store --store <path>') // TODO: after task Paparam flag relationships
test.todo('pear run pear://<key> --updates-diff')
test.todo('pear run pear://<key> --no-updates')
test.todo('pear run pear://<key> --link <url>')
test.todo('pear run pear://<key> --checkout <n>')
test.todo('pear run pear://<key> --checkout release')
test.todo('pear run pear://<key> --checkout staged')
test.todo('pear run pear://<key> --checkout <n> --unsafe-clear-app-storage --unsafe-clear-preferences')

test.todo('pear release <channel> <absolute-path>')
test.todo('pear release <channel> <relative-path>')
test.todo('pear release --json <channel> <relative-path>')
test.todo('pear release pear://<key>')
test.todo('pear release --json pear://<key>')
test.todo('pear release --checkout <n> pear://<key>')
test.todo('pear release --checkout <n> --json pear://<key>')
test.todo('pear release --checkout staged pear://<key>')
test.todo('pear release --checkout staged --json pear://<key>')
test.todo('pear release --checkout release pear://<key>')
test.todo('pear release --checkout release --json pear://<key>')

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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

test.todo('pear dump pear://<key> <absolute-path>')
test.todo('pear dump pear://<key> <relative-path>')
test.todo('pear dump --checkout <n> pear://<key> <relative-path>')
test.todo('pear dump --checkout staged pear://<key> <relative-path>')
test.todo('pear dump --checkout release pear://<key> <relative-path>')
test.todo('pear dump --json pear://<key> <relative-path>')

test.todo('pear shift <source> <destination>')
test.todo('pear shift --json <source> <destination>')
test.todo('pear shift --force <source> <destination>')
test.todo('pear shift --force --json <source> <destination>')

test.todo('pear gc releases')
test.todo('pear gc releases --json')
test.todo('pear gc sidecars')
test.todo('pear gc sidecars --json')

test.todo('pear versions')
test.todo('pear versions --json')
test.todo('pear -v')

test('commands cleanup', rig.cleanup)
