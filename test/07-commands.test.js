const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const { discoveryKey } = require('hypercore-crypto')
const fs = require('bare-fs')
const parseLink = require('../lib/parse-link')

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

  cleanup = async ({ comment }) => {
    comment('shutting down local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

test('commands setup', rig.setup)

test('pear shift <source> <destination>', async function ({ plan, is, teardown, timeout }) {
  plan(2)
  timeout(180000)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(shiftSuccess, true, 'should successfully shift app storage')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  await running.until.exit
})

test('pear shift --json <source> <destination>', async function ({ plan, is, alike, teardown, timeout }) {
  plan(2)
  timeout(180000)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  alike(tags, ['moving', 'complete', 'final'], 'should output correct tags')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  await running.until.exit
})

test('pear shift --force <source> <destination>', async function ({ plan, is, teardown, timeout }) {
  plan(3)
  timeout(180000)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  await running.inspector.evaluate('__PEAR_TEST__.ipc.destroy()', { returnByValue: false })
  await running.inspector.close()

  is(shiftSuccess, true, 'should successfully shift app storage')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  is(fs.existsSync(path.join(appStorage2, 'testold.txt')), false, 'should delete existing app storage file at destination')
  await running.until.exit
})

test('pear shift --force --json <source> <destination>', async function ({ plan, is, teardown, timeout, alike }) {
  plan(3)
  timeout(180000)

  const relativePath = path.relative(harness, minimal)

  const testId1 = Math.floor(Math.random() * 100000)
  const argvInit1 = ['stage', '--json', `test-${testId1}`, relativePath]
  const stager1 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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
  const stager2 = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
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

  alike(tags, ['moving', 'complete', 'final'], 'should output correct tags')
  is(fs.existsSync(path.join(appStorage2, 'test.txt')), true, 'should move app storage file to destination')
  is(fs.existsSync(path.join(appStorage2, 'testold.txt')), false, 'should delete existing app storage file at destination')
  await running.until.exit
})

test('commands cleanup', rig.cleanup)
