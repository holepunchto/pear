await runTests()

async function runTests() {
  const test = (await import('brittle')).default

  test.pause()

  await test.load(import.meta.resolve('./touch.test.js'))

  test.resume()
}
