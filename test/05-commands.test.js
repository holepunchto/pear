'use strict'
const fs = require('bare-fs')
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
    this.helper = new Helper()
    await this.helper.closeClients()
    await this.helper.shutdown()
    comment('local sidecar shut down')
  }
}

const rig = new Rig()

// test('commands setup', rig.setup)

test('pear stage --json <channel> <absolute-path>', async function ({ plan, alike, is }) {
  // plan(3)
  plan(2)
  const testId = Math.floor(Math.random() * 100000)
  const argv = ['stage', '--json', 'test-' + testId, minimal]
  // const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
  // await running.inspector.evaluate(`
  //     __PEAR_TEST__.command(${JSON.stringify(argv)})
  // `, { returnByValue: false })
  // const seen = new Set()
  // const tags = []
  // let link = null
  // for await (const line of running.lineout) {
  //   const result = JSON.parse(line)
  //   if (!link) link = result?.data?.link
  //   if (seen.has(result.tag)) continue
  //   seen.add(result.tag)
  //   tags.push(result.tag)
  //   if (result.tag === 'final') break
  // }
  // await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
  // await running.inspector.close()
  // alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'])
  // const { code } = await running.until.exit
  // is(code, 0)
  const check = await Helper.run(minimal)
  check.stdout.once('data', (line) => {
    is(line.toString().trim(), 'minimal')
  })
  check.once('exit', (code) => {
    is(code, 0)
  })
})

// test.todo('pear stage <channel> <absolute-path>')
// test.todo('pear stage <channel> <relative-path>')

// test.todo('pear stage <channel>')

// test('pear stage --json <channel>', async function ({ plan, alike, is }) {
//   plan(3)
//   const testId = Math.floor(Math.random() * 100000)
//   const argv = ['stage', '--json', 'test-' + testId]
//   const cwd = `'${minimal}'`
//   const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
//   await running.inspector.evaluate(`
//       __PEAR_TEST__.command(${JSON.stringify(argv)}, ${cwd})
//   `, { returnByValue: false })
//   const seen = new Set()
//   const tags = []
//   let link = null
//   for await (const line of running.lineout) {
//     const result = JSON.parse(line)
//     if (!link) link = result?.data?.link
//     if (seen.has(result.tag)) continue
//     seen.add(result.tag)
//     tags.push(result.tag)
//     if (result.tag === 'final') break
//   }
//   await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
//   await running.inspector.close()
//   alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'])
//   const { code } = await running.until.exit
//   is(code, 0)
//   const check = await Helper.run(link)
//   check.stdout.once('data', (line) => {
//     is(line.toString().trim(), 'minimal')
//   })
// })

// test('pear stage --json <channel> <relative-path>', async function ({ plan, alike, is }) {
//   plan(3)
//   const testId = Math.floor(Math.random() * 100000)
//   const cwd = `'${path.dirname(minimal)}'`
//   const argv = ['stage', '--json', 'test-' + testId, './minimal']
//   const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
//   await running.inspector.evaluate(`
//       __PEAR_TEST__.command(${JSON.stringify(argv)}, ${cwd})
//   `, { returnByValue: false })
//   const seen = new Set()
//   const tags = []
//   let link = null
//   for await (const line of running.lineout) {
//     const result = JSON.parse(line)
//     if (!link) link = result?.data?.link
//     if (seen.has(result.tag)) continue
//     seen.add(result.tag)
//     tags.push(result.tag)
//     if (result.tag === 'final') break
//   }
//   await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
//   await running.inspector.close()
//   alike(tags, ['staging', 'byte-diff', 'summary', 'skipping', 'complete', 'addendum', 'final'])
//   const { code } = await running.until.exit
//   is(code, 0)
//   const check = await Helper.run(link)
//   check.stdout.once('data', (line) => {
//     is(line.toString().trim(), 'minimal')
//   })
// })

// test('pear stage --dry-run --json <channel> <relative-path>', async function ({ plan, alike, is, teardown }) {
//   plan(4)
//   const cwd = `'${path.dirname(minimal)}'`
//   const testId = Math.floor(Math.random() * 100000)
//   let link = null
//   {
//     const argv = ['stage', '--json', 'test-' + testId, './minimal']
//     const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
//     await running.inspector.evaluate(`
//         __PEAR_TEST__.command(${JSON.stringify(argv)}, ${cwd})
//     `, { returnByValue: false })
//     for await (const line of running.lineout) {
//       const result = JSON.parse(line)
//       if (!link) link = result?.data?.link
//       if (result.tag === 'final') break
//     }
//     await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
//     await running.inspector.close()
//     await running.until.exit
//   }
//   const file = new Date().toISOString().replace(/[:.]/g, '-') + '.tmp'
//   const addition = path.join(minimal, file)
//   fs.writeFileSync(addition, 'test')
//   teardown(() => { fs.unlinkSync(addition) }, { order: -Infinity })

//   const argv = ['stage', '--json', '--dry-run', 'test-' + testId, './minimal']
//   const running = await Helper.open(harness, { tags: ['exit'] }, { lineout: true })
//   await running.inspector.evaluate(`
//       __PEAR_TEST__.command(${JSON.stringify(argv)}, ${cwd})
//   `, { returnByValue: false })
//   const seen = new Set()
//   const tags = []

//   for await (const line of running.lineout) {
//     const result = JSON.parse(line)
//     if (result.tag === 'skipping') is(result.data.reason, 'dry-run')
//     if (seen.has(result.tag)) continue
//     seen.add(result.tag)
//     tags.push(result.tag)
//     if (result.tag === 'final') break
//   }
//   await running.inspector.evaluate('__PEAR_TEST__.ipc.close()', { returnByValue: false })
//   await running.inspector.close()
//   alike(tags, ['staging', 'dry', 'byte-diff', 'summary', 'skipping', 'complete', 'final'])
//   const { code } = await running.until.exit
//   is(code, 0)
//   const check = await Helper.run(link)
//   check.stdout.once('data', (line) => {
//     is(line.toString().trim(), 'minimal')
//   })
// })

// test.todo('pear stage --dry-run <channel> <relative-path>')
// test.todo('pear stage --bare <channel> <relative-path>')
// test.todo('pear stage --bare --json <channel> <relative-path>')
// test.todo('pear stage --ignore <list> <channel> <relative-path>')
// test.todo('pear stage --ignore <list> --json <channel> <relative-path>')
// test.todo('pear stage --truncate <n> <channel> <relative-path>')
// test.todo('pear stage --truncate <n> --json <channel> <relative-path>')
// test.todo('pear stage --name <name> <channel> <relative-path>')
// test.todo('pear stage --name <name> --json <channel> <relative-path>')
// test.todo('pear stage --ignore <list> --name <name> <channel> <relative-path>')
// test.todo('pear stage --ignore <list> --name <name> --json <channel> <relative-path>')
// test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> <channel> <relative-path>')
// test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json <channel> <relative-path>')
// test.todo('pear stage pear://<key>')
// test.todo('pear stage --json pear://<key>')
// test.todo('pear stage --dry-run pear://<key>')
// test.todo('pear stage --dry-run --json pear://<key>')
// test.todo('pear stage --bare pear://<key>')
// test.todo('pear stage --bare --json pear://<key>')
// test.todo('pear stage --ignore <list> pear://<key>')
// test.todo('pear stage --ignore <list> --json pear://<key>')
// test.todo('pear stage --truncate <n> pear://<key>')
// test.todo('pear stage --truncate <n> --json pear://<key>')
// test.todo('pear stage --name <name> pear://<key>')
// test.todo('pear stage --name <name> --json pear://<key>')
// test.todo('pear stage --ignore <list> --name <name> pear://<key>')
// test.todo('pear stage --ignore <list> --name <name> --json pear://<key>')
// test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> pear://<key>')
// test.todo('pear stage --dry-run --bare --ignore <list> --truncate <n> --name <name> --json pear://<key>')

test('commands cleanup', rig.cleanup)
