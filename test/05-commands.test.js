const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fs = require('bare-fs')

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

  getOrCreateDumpInstance = async () => {
    if (this.pearDumpInstance) return this.pearDumpInstance

    const testId = Math.floor(Math.random() * 100000)
    const argvStage = ['stage', '--json', 'test-' + testId, minimal]
    const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
    await stager1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvStage)})
  `, { returnByValue: false })

    for await (const line of stager1.lineout) {
      const result = JSON.parse(line)
      if (result.tag === 'addendum') this.pearDumpInstance = result.data
      if (result.tag === 'final') break
    }

    await stager1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
    await stager1.inspector.close()
    await stager1.until.exit

    const argvRelease = ['release', '--json', 'test-' + testId, minimal]
    const releaser1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
    await releaser1.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvRelease)})
  `, { returnByValue: false })

    for await (const line of releaser1.lineout) {
      const result = JSON.parse(line)
      if (result.tag === 'final') break
    }

    await releaser1.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
    await releaser1.inspector.close()
    await releaser1.until.exit

    fs.writeFileSync(path.join(minimal, 'testfile.txt'), 'this is a test file')

    const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
    await stager2.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argvStage)})
  `, { returnByValue: false })

    for await (const line of stager2.lineout) {
      const result = JSON.parse(line)
      if (result.tag === 'addendum') {
        this.pearDumpInstance.versionOld = this.pearDumpInstance.version
        this.pearDumpInstance.version = result.data.version
      }
      if (result.tag === 'final') break
    }

    await stager2.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
    await stager2.inspector.close()
    await stager2.until.exit

    fs.unlinkSync(path.join(minimal, 'testfile.txt'))

    return this.pearDumpInstance
  }

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

test('pear stage --json <channel> <absolute-path>', async function ({ plan, alike, is }) {
  plan(1)

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
  await running.until.exit
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

test('pear dump pear://<key> <absolute-path>', async function ({ plan, is, teardown }) {
  plan(4)
  const { link } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(harness, `pear-dump-${testId}`)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  const argv = ['dump', link, targetDir]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let dumpSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      dumpSuccess = true
      break
    }
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(dumpSuccess, true, 'should dump successfully')
  is(fs.existsSync(targetDir), true, 'should create target directory')
  is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
  is(fs.existsSync(path.join(targetDir, 'testfile.txt')), true, 'should dump testfile.txt')
  await running.until.exit
})

test('pear dump pear://<key> <relative-path>', async function ({ plan, is, teardown }) {
  plan(4)
  const { link } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(minimal, `pear-dump-${testId}`)
  const targetDirRelative = path.relative(harness, targetDir)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  const argv = ['dump', link, targetDirRelative]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let dumpSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      dumpSuccess = true
      break
    }
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(dumpSuccess, true, 'should dump successfully')
  is(fs.existsSync(targetDir), true, 'should create target directory')
  is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
  is(fs.existsSync(path.join(targetDir, 'testfile.txt')), true, 'should dump testfile.txt')
  await running.until.exit
})

test('pear dump --checkout <n> pear://<key> <relative-path>', async function ({ plan, is, teardown }) {
  plan(4)
  const { link, versionOld } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(minimal, `pear-dump-${testId}`)
  const targetDirRelative = path.relative(harness, targetDir)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  const argv = ['dump', link, '--checkout', `${versionOld}`, targetDirRelative]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let dumpSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      dumpSuccess = true
      break
    }
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(dumpSuccess, true, 'should dump successfully')
  is(fs.existsSync(targetDir), true, 'should create target directory')
  is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
  is(fs.existsSync(path.join(targetDir, 'testfile.txt')), false, 'should not dump testfile.txt')
  await running.until.exit
})

test('pear dump --checkout staged pear://<key> <relative-path>', async function ({ plan, is, teardown }) {
  plan(4)
  const { link } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(minimal, `pear-dump-${testId}`)
  const targetDirRelative = path.relative(harness, targetDir)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  const argv = ['dump', link, '--checkout', 'staged', targetDirRelative]
  await running.inspector.evaluate(`
      __PEAR_TEST__.command(${JSON.stringify(argv)})
  `, { returnByValue: false })

  let dumpSuccess = false
  for await (const line of running.lineout) {
    if (line.endsWith('Success')) {
      dumpSuccess = true
      break
    }
  }

  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(dumpSuccess, true, 'should dump successfully')
  is(fs.existsSync(targetDir), true, 'should create target directory')
  is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
  is(fs.existsSync(path.join(targetDir, 'testfile.txt')), true, 'should dump testfile.txt')
  await running.until.exit
})

// TODO: Uncomment once --checkout release is supported
// test('pear dump --checkout release pear://<key> <relative-path>', async function ({ plan, is, teardown }) {
//   plan(4)
//   const { link } = await rig.getOrCreateDumpInstance()
//
//   const testId = Math.floor(Math.random() * 100000)
//   const targetDir = path.join(minimal, `pear-dump-${testId}`)
//   const targetDirRelative = path.relative(harness, targetDir)
//   teardown(async () => fs.promises.rm(targetDir, { recursive: true }))
//
//   const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
//   const argv = ['dump', link, '--checkout', 'release', targetDirRelative]
//   await running.inspector.evaluate(`
//       __PEAR_TEST__.command(${JSON.stringify(argv)})
//   `, { returnByValue: false })
//
//   let dumpSuccess = false
//   for await (const line of running.lineout) {
//     if (line.endsWith('Success')) {
//       dumpSuccess = true
//       break
//     }
//   }
//
//   await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
//   await running.inspector.close()
//
//   is(dumpSuccess, true, 'should dump successfully')
//   is(fs.existsSync(targetDir), true, 'should create target directory')
//   is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
//   is(fs.existsSync(path.join(targetDir, 'testfile.txt')), false, 'should not dump testfile.txt')
//   await running.until.exit
// })

test('pear dump --json pear://<key> <relative-path>', async function ({ plan, is, alike, teardown }) {
  plan(4)
  const { link } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(minimal, `pear-dump-${testId}`)
  const targetDirRelative = path.relative(harness, targetDir)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true, platformDir: rig.platformDir })
  const argv = ['dump', '--json', link, targetDirRelative]
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

  alike(tags, ['dumping', 'byte-diff', 'final'], 'should output correct tags')
  is(fs.existsSync(targetDir), true, 'should create target directory')
  is(fs.existsSync(path.join(targetDir, 'package.json')), true, 'should dump package.json')
  is(fs.existsSync(path.join(targetDir, 'testfile.txt')), true, 'should dump testfile.txt')
  await running.until.exit
})

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
