const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const { discoveryKey } = require('hypercore-crypto')
const fs = require('bare-fs')
const parseLink = require('../lib/parse-link')

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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })

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
test.todo('pear run <relative-path> --updates-diff --no-updates') // TODO: after task Paparam flag relationships
test.todo('pear run <relative-path> --tmp-store --store <path>') // TODO: after task Paparam flag relationships
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

test.todo('pear info')
test.todo('pear info --json')
test.todo('pear info <channel> <relative-path>')
test.todo('pear info --json <channel> <relative-path>')
test.todo('pear info --changelog <channel> <relative-path>')
test.todo('pear info --changelog --json <channel> <relative-path>')
test.todo('pear info --changelog --metadata <channel> <relative-path>')
test.todo('pear info --changelog --metadata --json <channel> <relative-path>')
test.todo('pear info --changelog --key <key> <channel> <relative-path>')
test.todo('pear info --changelog --key <key> --json <channel> <relative-path>')
test.todo('pear info --changelog --metadata --key <channel> <relative-path>')
test.todo('pear info --changelog --metadata --key --json <channel> <relative-path>')
test.todo('pear info --full-changelog <channel> <relative-path>')
test.todo('pear info --full-changelog --metadata <channel> <relative-path>')
test.todo('pear info --full-changelog --metadata --json <channel> <relative-path>')
test.todo('pear info --full-changelog --metadata --key <channel> <relative-path>')
test.todo('pear info --full-changelog --metadata --key --json <channel> <relative-path>')
test.todo('pear info --full-changelog --changelog') // TODO: after task Paparam flag relationships
test.todo('pear info --metadata <channel> <relative-path>')
test.todo('pear info --metadata --key <channel> <relative-path>')
test.todo('pear info --metadata --key --json <channel> <relative-path>')
test.todo('pear info --key <channel> <relative-path>')
test.todo('pear info --key --json <channel> <relative-path>')
test.todo('pear info pear://<key>')
test.todo('pear info --json pear://<key>')
test.todo('pear info --changelog pear://<key>')
test.todo('pear info --changelog --json pear://<key>')
test.todo('pear info --changelog --metadata pear://<key>')
test.todo('pear info --changelog --metadata --json pear://<key>')
test.todo('pear info --changelog --key pear://<key>')
test.todo('pear info --changelog --key --json pear://<key>')
test.todo('pear info --changelog --metadata --key pear://<key>')
test.todo('pear info --changelog --metadata --key --json pear://<key>')
test.todo('pear info --full-changelog pear://<key>')
test.todo('pear info --full-changelog --metadata pear://<key>')
test.todo('pear info --full-changelog --metadata --json pear://<key>')
test.todo('pear info --full-changelog --metadata --key pear://<key>')
test.todo('pear info --full-changelog --metadata --key --json pear://<key>')
test.todo('pear info --metadata pear://<key>')
test.todo('pear info --metadata --key pear://<key>')
test.todo('pear info --metadata --key --json pear://<key>')
test.todo('pear info --key pear://<key>')
test.todo('pear info --key --json pear://<key>')

test.todo('pear info --no-changelog <channel> <relative-path>')
test.todo('pear info --no-changelog --json <channel> <relative-path>')
test.todo('pear info --no-metadata <channel> <relative-path>')
test.todo('pear info --no-metadata --json <channel> <relative-path>')
test.todo('pear info --no-key <channel> <relative-path>')
test.todo('pear info --no-key --json <channel> <relative-path>')
test.todo('pear info --no-changelog --no-metadata <channel> <relative-path>')
test.todo('pear info --no-changelog --no-metadata --json <channel> <relative-path>')
test.todo('pear info --no-changelog --no-key <channel> <relative-path>')
test.todo('pear info --no-changelog --no-key --json <channel> <relative-path>')
test.todo('pear info --no-key --no-metadata <channel> <relative-path>')
test.todo('pear info --no-key --no-metadata --json <channel> <relative-path>')
test.todo('pear info --no-changelog --no-metadata --no-key <channel> <relative-path>')
test.todo('pear info --no-changelog --no-metadata --no-key --json <channel> <relative-path>')
test.todo('pear info --no-changelog pear://<key>')
test.todo('pear info --no-changelog --json pear://<key>')
test.todo('pear info --no-metadata pear://<key>')
test.todo('pear info --no-metadata --json pear://<key>')
test.todo('pear info --no-key pear://<key>')
test.todo('pear info --no-key --json pear://<key>')
test.todo('pear info --no-changelog --no-metadata pear://<key>')
test.todo('pear info --no-changelog --no-metadata --json pear://<key>')
test.todo('pear info --no-changelog --no-key pear://<key>')
test.todo('pear info --no-changelog --no-key --json pear://<key>')
test.todo('pear info --no-key --no-metadata pear://<key>')
test.todo('pear info --no-key --no-metadata --json pear://<key>')
test.todo('pear info --no-changelog --no-metadata --no-key pear://<key>')
test.todo('pear info --no-changelog --no-metadata --no-key --json pear://<key>')

test.todo('pear dump pear://<key> <absolute-path>')
test.todo('pear dump pear://<key> <relative-path>')
test.todo('pear dump --checkout <n> pear://<key> <relative-path>')
test.todo('pear dump --checkout staged pear://<key> <relative-path>')
test.todo('pear dump --checkout release pear://<key> <relative-path>')
test.todo('pear dump --json pear://<key> <relative-path>')

test('pear shift <source> <destination>', async function ({ plan, is, teardown }) {
  plan(3)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit1)})
  `, { returnByValue: false })

  let staged1
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged1 = result.data
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  await stager1.until.exit

  const testId2 = Math.floor(Math.random() * 100000)
  const argvInit2 = ['stage', '--json', `test-${testId2}`, relativePath]
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit2)})
  `, { returnByValue: false })

  let staged2
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged2 = result.data
    if (result.tag === 'final') break
  }

  const pearDir = (await stager2.inspector.evaluate('Pear.config.pearDir')).value

  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()
  await stager2.until.exit

  const storageDir = path.join(pearDir, 'app-storage', 'by-dkey')
  const appStorage1 = path.join(storageDir, discoveryKey(parseLink(staged1.link).drive.key).toString('hex'))
  const appStorage2 = path.join(storageDir, discoveryKey(parseLink(staged2.link).drive.key).toString('hex'))

  fs.mkdirSync(appStorage1, { recursive: true })
  fs.writeFileSync(path.join(appStorage1, 'test.txt'), 'test')
  teardown(async () => {
    await fs.promises.rm(appStorage1, { recursive: true }).catch(() => {})
    await fs.promises.rm(appStorage2, { recursive: true }).catch(() => {})
  })

  const argv = ['shift', staged1.link, staged2.link]
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let shiftSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      shiftSuccess = true
      break
    }
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await running.inspector.close()

  is(shiftSuccess, true, 'should successfully shift app storage')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear shift --json <source> <destination>', async function ({ plan, is, alike, teardown }) {
  plan(3)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit1)})
  `, { returnByValue: false })

  let staged1
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged1 = result.data
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  await stager1.until.exit

  const testId2 = Math.floor(Math.random() * 100000)
  const argvInit2 = ['stage', '--json', `test-${testId2}`, relativePath]
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit2)})
  `, { returnByValue: false })

  let staged2
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged2 = result.data
    if (result.tag === 'final') break
  }

  const pearDir = (await stager2.inspector.evaluate('Pear.config.pearDir')).value

  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()
  await stager2.until.exit

  const storageDir = path.join(pearDir, 'app-storage', 'by-dkey')
  const appStorage1 = path.join(storageDir, discoveryKey(parseLink(staged1.link).drive.key).toString('hex'))
  const appStorage2 = path.join(storageDir, discoveryKey(parseLink(staged2.link).drive.key).toString('hex'))

  fs.mkdirSync(appStorage1, { recursive: true })
  fs.writeFileSync(path.join(appStorage1, 'test.txt'), 'test')
  teardown(async () => {
    await fs.promises.rm(appStorage1, { recursive: true }).catch(() => {})
    await fs.promises.rm(appStorage2, { recursive: true }).catch(() => {})
  })

  const argv = ['shift', '--json', staged1.link, staged2.link]
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  alike(tags, ['moving', 'complete', 'final'], 'should output correct tags')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear shift --force <source> <destination>', async function ({ plan, is, teardown }) {
  plan(4)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit1)})
  `, { returnByValue: false })

  let staged1
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged1 = result.data
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  await stager1.until.exit

  const testId2 = Math.floor(Math.random() * 100000)
  const argvInit2 = ['stage', '--json', `test-${testId2}`, relativePath]
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit2)})
  `, { returnByValue: false })

  let staged2
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged2 = result.data
    if (result.tag === 'final') break
  }

  const pearDir = (await stager2.inspector.evaluate('Pear.config.pearDir')).value

  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()
  await stager2.until.exit

  const storageDir = path.join(pearDir, 'app-storage', 'by-dkey')
  const appStorage1 = path.join(storageDir, discoveryKey(parseLink(staged1.link).drive.key).toString('hex'))
  const appStorage2 = path.join(storageDir, discoveryKey(parseLink(staged2.link).drive.key).toString('hex'))

  fs.mkdirSync(appStorage1, { recursive: true })
  fs.mkdirSync(appStorage2, { recursive: true })
  fs.writeFileSync(path.join(appStorage1, 'test.txt'), 'test')
  fs.writeFileSync(path.join(appStorage2, 'testold.txt'), 'test')
  teardown(async () => {
    await fs.promises.rm(appStorage1, { recursive: true }).catch(() => {})
    await fs.promises.rm(appStorage2, { recursive: true }).catch(() => {})
  })

  const argv = ['shift', '--force', staged1.link, staged2.link]
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let shiftSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      shiftSuccess = true
      break
    }
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  await running.inspector.close()

  is(shiftSuccess, true, 'should successfully shift app storage')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  is(fs.existsSync(path.join(appStorage2, 'testold.txt')), false, 'should delete existing app storage file at destination')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear shift --force --json <source> <destination>', async function ({ plan, is, teardown, alike }) {
  plan(4)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit1)})
  `, { returnByValue: false })

  let staged1
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged1 = result.data
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  await stager1.until.exit

  const testId2 = Math.floor(Math.random() * 100000)
  const argvInit2 = ['stage', '--json', `test-${testId2}`, relativePath]
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit2)})
  `, { returnByValue: false })

  let staged2
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') staged2 = result.data
    if (result.tag === 'final') break
  }

  const pearDir = (await stager2.inspector.evaluate('Pear.config.pearDir')).value

  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()
  await stager2.until.exit

  const storageDir = path.join(pearDir, 'app-storage', 'by-dkey')
  const appStorage1 = path.join(storageDir, discoveryKey(parseLink(staged1.link).drive.key).toString('hex'))
  const appStorage2 = path.join(storageDir, discoveryKey(parseLink(staged2.link).drive.key).toString('hex'))

  fs.mkdirSync(appStorage1, { recursive: true })
  fs.mkdirSync(appStorage2, { recursive: true })
  fs.writeFileSync(path.join(appStorage1, 'test.txt'), 'test')
  fs.writeFileSync(path.join(appStorage2, 'testold.txt'), 'test')
  teardown(async () => {
    await fs.promises.rm(appStorage1, { recursive: true }).catch(() => {})
    await fs.promises.rm(appStorage2, { recursive: true }).catch(() => {})
  })

  const argv = ['shift', '--force', '--json', staged1.link, staged2.link]
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
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

  alike(tags, ['moving', 'complete', 'final'], 'should output correct tags')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  is(fs.existsSync(path.join(appStorage2, 'testold.txt')), false, 'should delete existing app storage file at destination')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test.todo('pear gc releases')
test.todo('pear gc releases --json')
test.todo('pear gc sidecars')
test.todo('pear gc sidecars --json')

test.todo('pear versions')
test.todo('pear versions --json')
test.todo('pear -v')

test('commands cleanup', rig.cleanup)
