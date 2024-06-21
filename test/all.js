// This runner is auto-generated by Brittle

runTests()

async function runTests () {
  const test = (await import('brittle')).default

  test.pause()

  await import('./01-smoke.test.js')
  await import('./02-shutdown.test.js')
  await import('./03-teardown.test.js')
  await import('./04-updates.test.js')

  test.resume()
}