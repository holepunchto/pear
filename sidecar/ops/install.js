await sidecar.ready()

const installer = new Installer({
  ...opts,
  corestore: sidecar.corestore,
  swarm: sidecar.swarm
})
