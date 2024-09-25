const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const fs = require('bare-fs')

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

  getOrCreateDumpInstance = async () => {
    if (this.pearDumpInstance) return this.pearDumpInstance

    const testId = Math.floor(Math.random() * 100000)
    const argvStage = ['stage', '--json', 'test-' + testId, minimal]
    const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
    const releaser1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

    const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

test('pear dump pear://<key> <absolute-path>', async function ({ plan, is, teardown }) {
  plan(4)
  const { link } = await rig.getOrCreateDumpInstance()

  const testId = Math.floor(Math.random() * 100000)
  const targetDir = path.join(harness, `pear-dump-${testId}`)
  teardown(async () => fs.promises.rm(targetDir, { recursive: true }))

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
//   const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

test('commands cleanup', rig.cleanup)
