// quick sniff is this is actually the cli for mega fast cli bool
if (Bare.argv.indexOf('--sidecar') > -1) {
  await import('./lib/daemon.js')
} else {
  await import('./cli.js')
}
