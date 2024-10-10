const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fs = require('bare-fs')
const LocalDrive = require('localdrive')

const fixtures = path.join(Helper.localDir, 'test', 'fixtures')
const harness = path.join(fixtures, 'harness')
const minimal = path.join(fixtures, 'minimal')

const rig = new Helper.Rig()

test.hook('commands setup', rig.setup)

test('pear stage --json <channel> <absolute-path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const argv = ['stage', '--json', 'test-' + testId, minimal]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage <channel> <absolute-path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const argv = ['stage', 'test-' + testId, minimal]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage <channel> <relative-path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage <channel> <relative-path> (package.json pear.config.stage.entrypoints <relative-paths>)', async function ({ plan, teardown, is }) {
  plan(2)

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
  teardown(() => { fs.rmSync(targetDir, { recursive: true }) })

  const relativePath = path.relative(harness, targetDir)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage <channel> <relative-path> (package.json pear.stage.ignore <relative-paths>)', async function ({ plan, teardown, is }) {
  plan(3)

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
  teardown(() => { fs.rmSync(targetDir, { recursive: true }) })

  const relativePath = path.relative(harness, targetDir)
  const argv = ['stage', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignoreinner.txt')) addedIgnored = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignoreinner.txt')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of running.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)
    if (result.tag === 'final') break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run <channel> <relative-path>', async function ({ plan, is }) {
  plan(2)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--dry-run', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of running.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--dry-run', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completeTag?.data?.dryRun, true)
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --bare <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--bare', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let skippedWarmup = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Skipping warmup (bare)')) skippedWarmup = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(skippedWarmup, true, 'should skip warmup')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --bare --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--bare', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(skipTag?.data?.reason, 'bare', 'should skip warmup')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  let addedIndex = false
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignored.txt')) addedIgnored = true
    if (line.includes('/index.js')) addedIndex = true
    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --truncate <n> <channel> <relative-path>', async function ({ plan, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--truncate', '0', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let readdedFile = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/index.js')) readdedFile = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd index.js')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --truncate <n> --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--truncate', '0', '--json', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/index.js'), true, 'should readd index.js')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --name <name> <channel> <relative-path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--name', 'test-name-' + testId, 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let stagedName
  const stagingRegex = /Staging (.*) into/
  for await (const line of running.lineout) {
    if (line === 'Staging complete!') completedStaging = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --name <name> --json <channel> <relative-path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argv = ['stage', '--name', 'test-name-' + testId, '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --name <name> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(5)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--name', 'test-name-' + testId, 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')

  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --name <name> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(5)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const argv = ['stage', '--ignore', 'ignored.txt', '--name', 'test-name-' + testId, '--json', 'test-' + testId, relativePath]

  const running = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await running.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await running.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await running.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await running.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> <channel> <relative-path>', async function ({ plan, teardown, is }) {
  plan(7)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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

  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json <channel> <relative-path>', async function ({ plan, alike, teardown, is }) {
  plan(7)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  for await (const line of stager1.lineout) {
    if (line.endsWith('Success')) break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, '--json', 'test-' + testId, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage pear://<key> <path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  const seen = new Set()
  const tags = []
  for await (const line of stager2.lineout) {
    const result = JSON.parse(line)
    if (seen.has(result.tag)) continue
    seen.add(result.tag)
    tags.push(result.tag)

    if (result.tag === 'final') break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run pear://<key> <path>', async function ({ plan, is }) {
  plan(3)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging dry run complete!') completedStaging = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  alike(tags, ['staging', 'dry', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  is(completeTag?.data?.dryRun, true, 'should be dry run')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --bare pear://<key> <path>', async function ({ plan, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--bare', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let skippedWarmup = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.endsWith('Skipping warmup (bare)')) skippedWarmup = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(skippedWarmup, true, 'should skip warmup')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --bare --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--bare', '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(skipTag?.data?.reason, 'bare', 'should skip warmup')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> pear://<key> <path>', async function ({ plan, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let addedIgnored = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/ignored.txt')) addedIgnored = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --json pear://<key> <path>', async function ({ plan, alike, teardown, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --truncate <n> pear://<key> <path>', async function ({ plan, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--truncate', '0', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  let readdedFile = false
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true
    if (line.includes('/package.json')) readdedFile = true
    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --truncate <n> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--truncate', '0', '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --name <name> pear://<key> <path>', async function ({ plan, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

  let completedStaging = false
  const stagingRegex = /Staging (.*) into/
  let stagedName
  for await (const line of stager2.lineout) {
    if (line === 'Staging complete!') completedStaging = true

    const stagingMatch = line.match(stagingRegex)
    if (stagingMatch) stagedName = stagingMatch[1]

    if (line.endsWith('Success')) break
  }
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --name <name> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(4)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --name <name> pear://<key> <path>', async function ({ plan, teardown, is }) {
  plan(5)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --ignore <list> --name <name> --json pear://<key> <path>', async function ({ plan, alike, teardown, is }) {
  plan(5)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const ignoredFile = path.join(harness, 'ignored.txt')
  fs.writeFileSync(ignoredFile, 'this file should be ignored')
  teardown(() => { try { fs.unlinkSync(ignoredFile) } catch { /* ignore */ } })
  const argv = ['stage', '--ignore', 'ignored.txt', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'summary', 'skipping', 'complete', 'addendum', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> pear://<key> <path>', async function ({ plan, is }) {
  plan(7)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(completedStaging, true, 'should complete staging')
  is(readdedFile, true, 'should readd package.json after truncate')
  is(addedIgnored, false, 'should not add ignored.txt')
  is(addedIndex, true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json pear://<key> <path>', async function ({ plan, alike, is }) {
  plan(7)

  const testId = Math.floor(Math.random() * 100000)
  const relativePath = path.relative(harness, minimal)
  const argvInit = ['stage', '--json', 'test-' + testId, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  await stager1.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argvInit)}) `, { returnByValue: false })

  let link
  for await (const line of stager1.lineout) {
    const result = JSON.parse(line)
    if (result.tag === 'addendum') link = result.data.link
    if (result.tag === 'final') break
  }

  await stager1.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager1.inspector.close()
  const { code: code1 } = await stager1.until.exit
  is(code1, 0, 'should have exit code 0 for initial stage')

  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { ...rig, lineout: true })
  const argv = ['stage', '--dry-run', '--bare', '--ignore', 'ignored.txt', '--truncate', '0', '--name', `test-name-${testId}`, '--json', link, relativePath]
  await stager2.inspector.evaluate(` __PEAR_TEST__.command(${JSON.stringify(argv)}) `, { returnByValue: false })

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
  await stager2.inspector.evaluate('__PEAR_TEST__.close()', { returnByValue: false })
  await stager2.inspector.close()

  is(files.includes('/package.json'), true, 'should readd package.json after truncate')
  is(files.includes('/ignored.txt'), false, 'should not add ignored.txt')
  is(files.includes('/index.js'), true, 'should add index.js')
  is(stagedName, 'test-name-' + testId, 'should use --name flag')
  alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'], 'should output expected tags')
  const { code } = await stager2.until.exit
  is(code, 0, 'should have exit code 0')
})

test.hook('commands cleanup', rig.cleanup)
