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

test('pear stage --json <channel> <absolute-path>', async function ({ plan, alike, is }) {
  plan(1)

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
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage <channel> <absolute-path>', async function ({ plan, is }) {
  plan(1)

  const testId = Math.floor(Math.random() * 100000)
  const argv = ['stage', 'test-' + testId, minimal]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await running.until.exit
})

test('pear stage <channel> <relative-path>', async function ({ plan, is }) {
  plan(1)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await running.until.exit
})

test('pear stage <channel> <relative-path> (package.json pear.config.stage.entrypoints <relative-paths>)', async function ({ plan, teardown, is }) {
  plan(1)

  const testId = Math.floor(Math.random() * 100000)

  const tmp = path.join(fixtures, '.tmp')
  const targetDir = path.join(tmp, `pear-test-${testId}`)
  const sourceDrive = new LocalDrive(minimal)
  const targetDrive = new LocalDrive(targetDir)
  const mirror = sourceDrive.mirror(targetDrive, { prune: false })
  // eslint-disable-next-line no-unused-vars
  for await (const val of mirror) { /* ignore */ }

  const originalPackageJson = fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')
  const packageJson = JSON.parse(originalPackageJson)
  packageJson.pear.stage = { entrypoints: ['index.js'] }
  fs.writeFileSync(path.join(targetDir, 'run.js'), 'console.log("run")')
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  teardown(async () => { await fs.promises.rm(targetDir, { recursive: true }) })

  const relativePath = path.relative(harness, targetDir)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await running.until.exit
})

test('pear stage <channel> <relative-path> (package.json pear.stage.ignore <relative-paths>)', async function ({ plan, teardown, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)

  const tmp = path.join(fixtures, '.tmp')
  const targetDir = path.join(tmp, `pear-test-${testId}`)
  fs.mkdirSync(targetDir, { recursive: true })
  const sourceDrive = new LocalDrive(minimal)
  const targetDrive = new LocalDrive(targetDir)
  const mirror = sourceDrive.mirror(targetDrive, { prune: false })
  // eslint-disable-next-line no-unused-vars
  for await (const val of mirror) { /* ignore */ }

  const originalPackageJson = fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')
  const packageJson = JSON.parse(originalPackageJson)
  packageJson.pear.stage = { ignore: ['/ignoreinner.txt'] }
  fs.writeFileSync(path.join(targetDir, 'ignoreinner.txt'), 'this file should be ignored')
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  teardown(async () => { await fs.promises.rm(targetDir, { recursive: true }) })

  const relativePath = path.relative(harness, targetDir)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignoreinner.txt')) addedIgnored = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignoreinner.txt')
  await running.until.exit
})

test('pear stage --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(1)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--json', 'test-' + testId, relativePath]

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
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --dry-run <channel> <relative-path>', async function ({ plan, is }) {
  plan(1)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--dry-run', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await running.until.exit
})

test('pear stage --dry-run --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--dry-run', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let completeTag
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'complete') completeTag = result
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completeTag?.data?.dryRun, true)
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --bare <channel> <relative-path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--bare', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let skippedWarmup = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Skipping warmup (bare)')) skippedWarmup = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(skippedWarmup, true, 'should skip warmup')
  await running.until.exit
})

test('pear stage --bare --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--bare', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let skipTag
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'skipping') skipTag = result
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(skipTag?.data?.reason, 'bare', 'should skip warmup')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --ignore <list> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  let addedIndex = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignored.txt')) addedIgnored = true
    if (line.includes('/index.js')) addedIndex = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  await running.until.exit
})

test('pear stage --ignore <list> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --truncate <n> <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--truncate', '0', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let readdedFile = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/index.js')) readdedFile = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd index.js')
  await stager2.until.exit
})

test('pear stage --truncate <n> --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--truncate', '0', '--json', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/index.js'), true, 'should readd index.js')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --name <name> <channel> <relative-path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--name', 'test-name-' + testId, 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let stagedName
  const stagingRegex = /Staging (.*) into/
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  await running.until.exit
})

test('pear stage --name <name> --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--name', 'test-name-' + testId, '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let stagedName
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --ignore <list> --name <name> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--name', 'test-name-' + testId, 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  let addedIndex = false
  let stagedName
  const stagingRegex = /Staging (.*) into/
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/index.js')) addedIndex = true
    if (line.includes('/ignored.txt')) addedIgnored = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')

  await running.until.exit
})

test('pear stage --ignore <list> --name <name> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--name', 'test-name-' + testId, '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  let stagedName
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await running.until.exit
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(6)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const stagingRegex = /Staging (.*) into/
  let completedStaging = false
  let readdedFile = false
  let addedIndex = false
  let addedIgnored = false
  let stagedName
  for await (const line of stager2.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.includes('/package.json')) readdedFile = true
    if (line.includes('/index.js')) addedIndex = true
    if (line.includes('/ignored.txt')) addedIgnored = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }

  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  await stager2.until.exit
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(6)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, '--json', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  let stagedName
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage pear://<key> <path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await stager2.until.exit
})

test('pear stage --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --dry-run pear://<key> <path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  await stager2.until.exit
})

test('pear stage --dry-run --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let completeTag
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'complete') completeTag = result
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  alike(tags, ['staging', 'dry', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  is(completeTag?.data?.dryRun, true, 'should be dry run')
  await stager2.until.exit
})

test('pear stage --bare pear://<key> <path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--bare', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let skippedWarmup = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Skipping warmup (bare)')) skippedWarmup = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(skippedWarmup, true, 'should skip warmup')
  await stager2.until.exit
})

test('pear stage --bare --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--bare', '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let skipTag
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'skipping') skipTag = result
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(skipTag?.data?.reason, 'bare', 'should skip warmup')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --ignore <list> pear://<key> <path>', async function ({ plan, teardown, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignored.txt')) addedIgnored = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  await stager2.until.exit
})

test('pear stage --ignore <list> --json pear://<key> <path>', async function ({ plan, teardown, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  await stager2.until.exit
})

test('pear stage --truncate <n> pear://<key> <path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--truncate', '0', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let readdedFile = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/package.json')) readdedFile = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  await stager2.until.exit
})

test('pear stage --truncate <n> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--truncate', '0', '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --name <name> pear://<key> <path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  const stagingRegex = /Staging (.*) into/
  let stagedName
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  await stager2.until.exit
})

test('pear stage --name <name> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  let stagedName
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --ignore <list> --name <name> pear://<key> <path>', async function ({ plan, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  const stagingRegex = /Staging (.*) into/
  let stagedName
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.includes('/ignored.txt')) addedIgnored = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  await stager2.until.exit
})

test('pear stage --ignore <list> --name <name> --json pear://<key> <path>', async function ({ plan, alike, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  let stagedName
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  await stager2.until.exit
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> pear://<key> <path>', async function ({ plan, is }) {
  plan(6)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const stagingRegex = /Staging (.*) into/
  let completedStaging = false
  let readdedFile = false
  let addedIndex = false
  let addedIgnored = false
  let stagedName
  for await (const line of stager2.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.includes('/package.json')) readdedFile = true
    if (line.includes('/index.js')) addedIndex = true
    if (line.includes('/ignored.txt')) addedIgnored = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  await stager2.until.exit
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(6)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvInit)})
  `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  const files = []
  let stagedName
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'byte-diff') files.push(result.data.message)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'staging') stagedName = result.data.name
    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  await stager2.until.exit
})

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
// test.skip('pear info --full-changelog --changelog') // TODO: after task Paparam flag relationships
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
