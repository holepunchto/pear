// This runner is auto-generated by Brittle

runTests()

async function runTests () {
  const test = (await import('brittle')).default

  test.pause()

  await import('./01-smoke.test.js')
  await import('./02-teardown.test.js')
  await import('./03-worker.test.js')
  await import('./04-encrypted.test.js')
  // await import('./05-updates.test.js')
  await import('./06-shutdown.test.js')

  test.resume()
}
