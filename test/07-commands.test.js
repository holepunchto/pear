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

  getOrCreateSeedInstance = async (name) => {
    if (!this.pearSeedInstance) this.pearSeedInstance = {}
    const id = name ?? 'minimal'
    if (this.pearSeedInstance[id]) return this.pearSeedInstance[id]

    const testId = Math.floor(Math.random() * 100000)
    const relativePath = path.relative(harness, minimal)
    const argvInit = ['stage', '--json', 'test-' + testId, ...(name ? ['--name', name] : []), relativePath]
    const stager = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
    await stager.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

    for await (const line of stager.lineout) {
      const result = JSON.parse(line)
      if (result.tag === 'addendum') this.pearSeedInstance[id] = result.data
      if (result.tag === 'final') break
    }

    await stager.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
    await stager.inspector.close()
    await stager.until.exit

    return this.pearSeedInstance[id]
  }

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

test('pear seed <channel> <absolute-path>', async function ({ plan, is, timeout }) {
  plan(1)
  timeout(60000)

  const { channel } = await rig.getOrCreateSeedInstance()

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', channel, minimal]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let announced = false
  for await (const line of seeder.lineout) {
    if (line === '^_^ announced') {
      announced = true
      break
    }
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await seeder.inspector.close()

  is(announced, true, 'should successfully announce')
  await seeder.until.exit
})

test('pear seed <channel> <relative-path>', async function ({ plan, is, timeout }) {
  plan(1)
  timeout(60000)

  const { channel } = await rig.getOrCreateSeedInstance()

  const relativePath = path.relative(harness, minimal)
  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', channel, relativePath]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let announced = false
  for await (const line of seeder.lineout) {
    if (line === '^_^ announced') {
      announced = true
      break
    }
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await seeder.inspector.close()

  is(announced, true, 'should successfully announce')
  await seeder.until.exit
})

test('pear seed --json <channel> <relative-path>', async function ({ plan, is, alike, timeout }) {
  plan(1)
  timeout(60000)

  const { channel } = await rig.getOrCreateSeedInstance()

  const relativePath = path.relative(harness, minimal)
  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--json', channel, relativePath]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of seeder.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'announced') break
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await seeder.inspector.close()

  alike(tags, ['seeding', 'key', 'announced'], 'should output correct tags')
  await seeder.until.exit
})

test('pear seed --name <name> <channel> <relative-path>', async function ({ plan, is, timeout }) {
  plan(1)
  timeout(60000)

  const name = 'custom-name-' + Math.floor(Math.random() * 100000)
  const { channel } = await rig.getOrCreateSeedInstance(name)
  const relativePath = path.relative(harness, minimal)

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--name', name, channel, relativePath]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let announced = false
  for await (const line of seeder.lineout) {
    if (line === '^_^ announced') {
      announced = true
      break
    }
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await seeder.inspector.close()

  is(announced, true, 'should successfully announce')
  await seeder.until.exit
})

test('pear seed --name <name> --json <channel> <relative-path>', async function ({ plan, is, alike, timeout }) {
  plan(1)
  timeout(60000)

  const name = 'custom-name-' + Math.floor(Math.random() * 100000)
  const { channel } = await rig.getOrCreateSeedInstance(name)
  const relativePath = path.relative(harness, minimal)

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--name', name, '--json', channel, relativePath]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of seeder.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'announced') break
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await seeder.inspector.close()

  alike(tags, ['seeding', 'key', 'announced'], 'should output correct tags')
  await seeder.until.exit
})

test('pear seed pear://<key>', async function ({ plan, is, timeout }) {
  plan(1)
  timeout(60000)

  const { link } = await rig.getOrCreateSeedInstance()

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', link]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let announced = false
  for await (const line of seeder.lineout) {
    if (line === '^_^ announced') {
      announced = true
      break
    }
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await seeder.inspector.close()

  is(announced, true, 'should successfully announce')
  await seeder.until.exit
})

test('pear seed --json pear://<key>', async function ({ plan, is, alike, timeout }) {
  plan(1)
  timeout(60000)

  const { link } = await rig.getOrCreateSeedInstance()

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--json', link]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of seeder.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'announced') break
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await seeder.inspector.close()

  alike(tags, ['seeding', 'key', 'announced'], 'should output correct tags')
  await seeder.until.exit
})

test('pear seed --name <name> pear://<key>', async function ({ plan, is, timeout }) {
  plan(1)
  timeout(60000)

  const name = 'custom-name-' + Math.floor(Math.random() * 100000)
  const { link } = await rig.getOrCreateSeedInstance(name)

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--name', name, link]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let announced = false
  for await (const line of seeder.lineout) {
    if (line === '^_^ announced') {
      announced = true
      break
    }
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await seeder.inspector.close()

  is(announced, true, 'should successfully announce')
  await seeder.until.exit
})

test('pear seed --name <name> --json pear://<key>', async function ({ plan, is, alike, timeout }) {
  plan(1)
  timeout(60000)

  const name = 'custom-name-' + Math.floor(Math.random() * 100000)
  const { link } = await rig.getOrCreateSeedInstance(name)

  const seeder = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['seed', '--name', name, '--json', link]
  await seeder.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of seeder.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'announced') break
  }

  seeder.subprocess.kill('SIGINT')
  await seeder.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await seeder.inspector.close()

  alike(tags, ['seeding', 'key', 'announced'], 'should output correct tags')
  await seeder.until.exit
})

test('commands cleanup', rig.cleanup)
