'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const fsx = require('fs-native-extensions')
const crypto = require('hypercore-crypto')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const ScriptLinker = require('script-linker')
const plink = require('pear-api/link')
const hypercoreid = require('hypercore-id-encoding')
const { pathToFileURL } = require('url-file-url')
const { ERR_INTERNAL_ERROR, ERR_PERMISSION_REQUIRED } = require('pear-api/errors')
const { KNOWN_NODES_LIMIT } = require('pear-api/constants')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const Session = require('../lib/session')
const State = require('../state')

module.exports = class Run extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args, { autosession: false }) }

  async #op (params) {
    const { sidecar, client } = this
    const { flags, env, cwd, link, dir, args, cmdArgs, pkg = null } = params
    const { App } = sidecar

    const linkrep = link.startsWith('pear:') ? link.slice(0, 14) + '..' : '...' + link.slice(-14)
    const LOG_RUN_LINK = this.LOG_RUN_LINK = ['run', linkrep]
    LOG.info(LOG_RUN_LINK, 'start', linkrep)

    let { startId } = params
    const starting = sidecar.running.get(startId)
    if (starting) {
      LOG.info(LOG_RUN_LINK, startId, 'running, referencing existing client userData')
      client.userData = starting.client.userData
      return await starting.running
    }

    if (startId && !starting) throw ERR_INTERNAL_ERROR('start failure unrecognized startId')
    startId = client.userData?.startId || crypto.randomBytes(16).toString('hex')

    const session = this.session = new Session(client, startId)
    const id = client.userData?.id || `${client.id}@${startId}`
    client.userData = client.userData?.id ? client.userData : new App({ id, startId, session })
    const app = client.userData
    app.clients.add(client)

    this.push({ tag: 'initialized', data: { id } })

    const running = this.run({ app, flags, env, cwd, link, dir, startId, id, args, cmdArgs, pkg })
    sidecar.running.set(startId, { client, running })
    session.teardown(() => {
      const free = sidecar.running.get(startId)
      LOG.info(LOG_RUN_LINK, app.id, 'teardown')
      if (free.running === running) {
        sidecar.running.delete(startId)
        LOG.info(LOG_RUN_LINK, startId, 'removed from running set')
      }
      this.push({ tag: 'torndown', data: { id } })
    })
    try {
      const info = await running
      this.push({ tag: 'started', data: { id } })
      if (sidecar.updateAvailable !== null) {
        const { version, info } = sidecar.updateAvailable
        LOG.info(LOG_RUN_LINK, app.id, 'application update available, notifying application', version)
        this.push({ tag: 'updateAvailable', data: { id, version } })
        app.message({ type: 'pear/updates', app: true, version, diff: info.diff, updating: false, updated: true })
      }
      this.final = info
    } catch (err) {
      app.report({ err })
      this.final = { success: false, bail: { message: err.message, stack: err.stack, code: err.code, info: err.info } }
      await session.close()
    }
  }

  async run ({ app, flags, env, cwd, link, dir, startId, id, args, cmdArgs, pkg = null } = {}) {
    const { sidecar, session, LOG_RUN_LINK } = this
    if (LOG.INF) LOG.info(LOG_RUN_LINK, id, link.slice(0, 14) + '..')
    LOG.info(LOG_RUN_LINK, 'ensuring sidecar ready')
    await sidecar.ready()
    LOG.info(LOG_RUN_LINK, 'sidecar is ready')

    const parsed = plink.parse(link)
    LOG.info(LOG_RUN_LINK, id, 'loading encryption keys')

    const key = parsed.drive?.key

    if (key !== null && !flags.trusted) {
      const trusted = await sidecar.trusted(`pear://${hypercoreid.encode(key)}`)
      if (!trusted) {
        const state = new State({ startId, id, env, link, dir, cwd, flags, args, cmdArgs, run: true })
        app.state = state // needs to setup app state for decal trust dialog restart
        LOG.info(LOG_RUN_LINK, id, 'untrusted - bailing')
        throw ERR_PERMISSION_REQUIRED('Permission required to run key', { key })
      }
    }

    if (parsed.protocol !== 'pear:' && !link.startsWith('file:')) link = pathToFileURL(link).href

    link = plink.normalize(link)

    const { encryptionKey, appStorage } = await sidecar.model.getBundle(link) || await sidecar.model.addBundle(link, State.storageFromLink(parsed))

    await fs.promises.mkdir(appStorage, { recursive: true })

    const dht = { nodes: sidecar.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT }), bootstrap: sidecar.nodes }
    await sidecar.model.setDhtNodes(dht.nodes)
    const state = new State({ startId, id, dht, env, link, dir, cwd, flags, args, cmdArgs, run: true, storage: appStorage })
    const applingPath = state.appling?.path
    if (applingPath && state.key !== null) {
      const applingKey = state.key.toString('hex')
      LOG.info(LOG_RUN_LINK, id, 'appling detected, storing path')
      await sidecar.applings.set(applingKey, applingPath)
    }

    app.state = state

    if (state.key === null) {
      LOG.info(LOG_RUN_LINK, id, 'running from disk')
      const drive = new LocalDrive(state.dir, { followExternalLinks: true, followLinks: state.followSymlinks })
      this.#updatePearInterface(drive)
      const appBundle = new Bundle({
        drive,
        updatesDiff: state.updatesDiff,
        updateNotify: state.updates && ((version, info) => sidecar.updateNotify(version, info))
      })
      const linker = new ScriptLinker(appBundle, {
        builtins: sidecar.gunk.builtins,
        map: sidecar.gunk.app.map,
        mapImport: sidecar.gunk.app.mapImport,
        symbol: sidecar.gunk.app.symbol,
        protocol: sidecar.gunk.app.protocol,
        runtimes: sidecar.gunk.app.runtimes
      })
      await session.add(appBundle)
      app.linker = linker
      app.bundle = appBundle

      LOG.info(LOG_RUN_LINK, id, 'initializing state')

      try {
        await state.initialize({ bundle: appBundle, app, pkg })
        LOG.info(LOG_RUN_LINK, id, 'state initialized')
      } catch (err) {
        LOG.error([...LOG_RUN_LINK, 'internal'], 'Failed to initialize state for app id', id, err)
        throw err
      }
      LOG.info(LOG_RUN_LINK, id, 'checking minver')
      const updating = await app.minver()
      if (updating) LOG.info(LOG_RUN_LINK, id, 'minver updating:', !!updating)
      else LOG.info(LOG_RUN_LINK, id)
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'checking drive for encryption')
    const corestore = sidecar.getCorestore(state.manifest?.name, state.channel)
    let drive
    try {
      drive = new Hyperdrive(corestore, state.key, { encryptionKey })
      await drive.ready()
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') {
        LOG.error([...LOG_RUN_LINK, 'internal'], 'Failure checking for encryption for', link, 'app id:', id, err)
        throw err
      }
      LOG.info(LOG_RUN_LINK, id, 'drive is encrypted and key is required - bailing')
      throw ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
    }

    const appBundle = new Bundle({
      encryptionKey,
      corestore,
      appling: state.appling,
      channel: state.channel,
      checkout: state.checkout,
      key: state.key,
      name: state.manifest?.name,
      dir: state.key ? null : state.dir,
      updatesDiff: state.updatesDiff,
      drive,
      updateNotify: state.updates && ((version, info) => sidecar.updateNotify(version, info)),
      failure (err) { app.report({ err }) }
    })

    await session.add(appBundle)

    if (sidecar.swarm) appBundle.join(sidecar.swarm)

    const linker = new ScriptLinker(appBundle, {
      builtins: sidecar.gunk.builtins,
      map: sidecar.gunk.app.map,
      mapImport: sidecar.gunk.app.mapImport,
      symbol: sidecar.gunk.app.symbol,
      protocol: sidecar.gunk.app.protocol,
      runtimes: sidecar.gunk.app.runtimes
    })

    app.linker = linker
    app.bundle = appBundle

    try {
      await appBundle.calibrate()
    } catch (err) {
      if (err.code === 'DECODING_ERROR') {
        LOG.info(LOG_RUN_LINK, id, 'drive is encrypted and key is required - bailing')
        throw ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
      } else {
        LOG.error(LOG_RUN_LINK, 'Failure creating drive bundle for', link, 'app id:', id, err)
        await session.close()
        throw err
      }
    }

    LOG.info(LOG_RUN_LINK, id, 'initializing state')
    try {
      await state.initialize({ bundle: appBundle, app })
      LOG.info(LOG_RUN_LINK, id, 'state initialized')
    } catch (err) {
      LOG.error([...LOG_RUN_LINK, 'internal'], 'Failed to initialize state for app id', id, err)
    }
    if (appBundle.platformVersion !== null) {
      app.report({ type: 'upgrade' })
      LOG.info(LOG_RUN_LINK, id, 'app bundling..')
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'checking minver')
    const updating = await app.minver()
    if (updating) LOG.info(LOG_RUN_LINK, id, 'minver updating:', !!updating)
    else LOG.info(LOG_RUN_LINK, id, 'app bundling..')
    const bundle = await app.bundle.bundle(state.entrypoint)
    LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
    return { id, startId, bundle }
    // start is tied to the lifecycle of the client itself so we don't tear it down
  }

  async #updatePearInterface (drive) {
    try {
      const pkgEntry = await drive.entry('/package.json')
      if (pkgEntry === null) return
      const pkg = JSON.parse(await drive.get(pkgEntry))
      const isDevDep = !!pkg.devDependencies?.['pear-interface']
      if (isDevDep === false) return
      const pearInterfacePkgEntry = await drive.entry('/node_modules/pear-interface/package.json')
      if (pearInterfacePkgEntry === null) return
      const projPkg = JSON.parse(await drive.get(pearInterfacePkgEntry))
      const platPkg = JSON.parse(await this.sidecar.drive.get('/node_modules/pear-interface/package.json'))
      if (projPkg.version === platPkg.version) return
      const tmp = path.join(drive.root, 'node_modules', '.pear-interface.next')
      const mirror = this.sidecar.drive.mirror(new LocalDrive(tmp), { prefix: '/node_modules/pear-interface' })
      await mirror.done()
      const next = path.join(tmp, 'node_modules', 'pear-interface')
      const current = path.join(drive.root, 'node_modules', 'pear-interface')
      await fsx.swap(next, current)
      await fs.promises.rm(tmp, { recursive: true })
    } catch (err) {
      LOG.error('internal', 'Unexpected error while attempting to update pear-interface in project', drive.root, err)
    }
  }
}
