// This runner is auto-generated by Brittle

runTests()

async function runTests () {
  const test = (await import('brittle')).default

  test.pause()

  await import('./smoke.test.js')
  await import('./teardown.test.js')

  test.resume()
}
