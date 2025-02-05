// This runner is auto-generated by Brittle

runTests()

async function runTests () {
  const test = (await import('brittle')).default

  test.pause()

  await import('./01-smoke.test.js')
  await import('./02-teardown.test.js')
  await import('./03-worker.test.js')
  await import('./04-encrypted.test.js')
  await import('./05-updates.test.js')
  await import('./06-shutdown.test.js')
  await import('./07-warmup.test.js')
  await import('./08-reset.test.js')
  await import('./09-shift.test.js')
  await import('./10-data.test.js')
  await import('./11-dump.test.js')

  test.resume()
}
