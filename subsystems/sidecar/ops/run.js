'use strict'
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')
const fsx = require('fs-native-extensions')
const crypto = require('hypercore-crypto')
const LocalDrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const ScriptLinker = require('script-linker')
const plink = require('pear-link')
const hypercoreid = require('hypercore-id-encoding')
const { pathToFileURL } = require('url-file-url')
const { randomBytes } = require('hypercore-crypto')
const { ERR_PERMISSION_REQUIRED, ERR_CONNECTION } = require('pear-errors')
const { KNOWN_NODES_LIMIT, PLATFORM_DIR } = require('pear-constants')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const Session = require('../lib/session')
const DriveMonitor = require('../lib/drive-monitor')
const State = require('../state')

module.exports = class Run extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args, { autosession: false })
  }

  async #op(params) {
    this.#gcOrphanWorkers()
    const { sidecar, client } = this
    const { flags, env, cwd, link, dir, args, cmdArgs, pkg = null } = params
    const { App } = sidecar

    const linkrep = link.startsWith('pear:')
      ? link.slice(0, 14) + '..'
      : '...' + link.slice(-14)
    const LOG_RUN_LINK = (this.LOG_RUN_LINK = ['run', linkrep])
    LOG.info(LOG_RUN_LINK, 'start', linkrep)

    const startId = crypto.randomBytes(16).toString('hex')
    const session = (this.session = new Session(client, startId))
    const id = `${client.id}@${startId}`
    client.userData = new App({ id, startId, session })
    const app = client.userData
    app.clients.add(client)

    this.push({ tag: 'initialized', data: { id } })

    const running = this.run({
      app,
      flags,
      env,
      cwd,
      link,
      dir,
      startId,
      id,
      args,
      cmdArgs,
      pkg,
      pid: params.pid
    })
    sidecar.running.set(startId, { client, running })
    session.teardown(() => {
      const free = sidecar.running.get(startId)
      LOG.info(LOG_RUN_LINK, app.id, 'teardown')
      if (free.running === running) {
        sidecar.running.delete(startId)
        LOG.info(LOG_RUN_LINK, startId, 'removed from running set')
      }
    })
    try {
      const info = await running
      this.push({ tag: 'started', data: { id } })
      this.final = info
    } catch (err) {
      app.report({ err })
      this.final = {
        bail: {
          message: err.message,
          stack: err.stack,
          code: err.code,
          info: err.info
        }
      }
      await session.close()
    }
  }

  async run({
    app,
    flags,
    env,
    cwd,
    link,
    dir,
    startId,
    id,
    args,
    cmdArgs,
    pkg = null,
    pid
  } = {}) {
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
        const state = new State({
          startId,
          id,
          env,
          link,
          dir,
          cwd,
          flags,
          args,
          cmdArgs,
          run: true
        })
        app.state = state // needs to setup app state for decal trust dialog restart
        LOG.info(LOG_RUN_LINK, id, 'untrusted - bailing')
        throw ERR_PERMISSION_REQUIRED('Permission required to run key', { key })
      }
    }

    if (parsed.protocol !== 'pear:' && !link.startsWith('file:'))
      link = pathToFileURL(link).href

    link = plink.normalize(link)

    const { encryptionKey, appStorage } =
      (await sidecar.model.getBundle(link)) ||
      (await sidecar.model.addBundle(link, State.storageFromLink(parsed)))

    await fs.promises.mkdir(appStorage, { recursive: true })

    const dht = {
      nodes: sidecar.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT }),
      bootstrap: sidecar.nodes
    }
    await sidecar.model.setDhtNodes(dht.nodes)
    const state = new State({
      startId,
      id,
      dht,
      env,
      link,
      dir,
      cwd,
      flags,
      args,
      cmdArgs,
      run: true,
      storage: appStorage,
      pid
    })
    const applingPath = state.appling?.path
    if (applingPath && state.key !== null) {
      const applingKey = state.key.toString('hex')
      LOG.info(LOG_RUN_LINK, id, 'appling detected, storing path')
      await sidecar.applings.set(applingKey, applingPath)
    }

    app.state = state

    const corestore = sidecar.getCorestore(state.manifest?.name, state.channel)
    const fromDisk = state.key === null
    if (fromDisk) {
      LOG.info(LOG_RUN_LINK, id, 'running from disk')
      const drive = new LocalDrive(state.dir, {
        followExternalLinks: true,
        followLinks: state.followSymlinks
      })
      this.#updatePearInterface(drive)
      const appBundle = new Bundle({
        drive,
        updatesDiff: state.updatesDiff,
        // asset method doesnt get/add assets when running pre.js file
        asset: (opts) =>
          state.prerunning ? null : this.asset(opts, corestore),
        updateNotify:
          state.updates &&
          ((version, info) => sidecar.updateNotify(version, info))
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
      if (state.updates) app.bundle.watch()
      LOG.info(LOG_RUN_LINK, id, 'initializing state')
      try {
        await state.initialize({ bundle: app.bundle, app, pkg })
        LOG.info(LOG_RUN_LINK, id, 'state initialized')
      } catch (err) {
        LOG.error(
          [...LOG_RUN_LINK, 'internal'],
          'Failed to initialize state for app id',
          id,
          err
        )
        throw err
      }

      LOG.info(LOG_RUN_LINK, id, 'determining assets')
      state.update({ assets: await app.bundle.assets(state.manifest) })
      LOG.info(LOG_RUN_LINK, id, 'assets', state.assets)
      if (flags.preflight) return { bail: { code: 'PREFLIGHT' } }
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'checking drive for encryption')
    let drive
    try {
      drive = new Hyperdrive(corestore, state.key, { encryptionKey })
      await drive.ready()
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') {
        LOG.error(
          [...LOG_RUN_LINK, 'internal'],
          'Failure checking for encryption for',
          link,
          'app id:',
          id,
          err
        )
        throw err
      }
      LOG.info(
        LOG_RUN_LINK,
        id,
        'drive is encrypted and key is required - bailing'
      )
      throw ERR_PERMISSION_REQUIRED('Encryption key required', {
        key: state.key,
        encrypted: true
      })
    }

    const current = await sidecar.model.getCurrent(state.applink)
    const checkoutLength = state.checkout ?? current?.checkout.length ?? null
    const appBundle = new Bundle({
      swarm: sidecar.swarm,
      encryptionKey,
      corestore,
      appling: state.appling,
      channel: state.channel,
      checkout: parsed.drive.length ? parsed.drive.length : checkoutLength,
      key: state.key,
      name: state.manifest?.name,
      dir: state.key ? null : state.dir,
      updatesDiff: state.updatesDiff,
      drive,
      updateNotify: async (version, info) => {
        if (state.updates) sidecar.updateNotify(version, info)
        await this.sidecar.model.setCurrent(state.applink, {
          fork: version.fork,
          length: version.length
        })
      },
      // pre.js file only runs on disk, so no need for conditional
      asset: (opts) => this.asset(opts, corestore),
      failure(err) {
        app.report({ err })
      }
    })

    await session.add(appBundle)

    if (sidecar.swarm) appBundle.join() // note: no await is deliberate

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
      const { fork, length } = await app.bundle.calibrate()
      if (current === null)
        await this.sidecar.model.setCurrent(state.applink, { fork, length })
    } catch (err) {
      if (err.code === 'DECODING_ERROR') {
        LOG.info(
          LOG_RUN_LINK,
          id,
          'drive is encrypted and key is required - bailing'
        )
        throw ERR_PERMISSION_REQUIRED('Encryption key required', {
          key: state.key,
          encrypted: true
        })
      } else {
        LOG.error(
          LOG_RUN_LINK,
          'Failure creating drive bundle for',
          link,
          'app id:',
          id,
          err
        )
        await session.close()
        throw err
      }
    }

    LOG.info(LOG_RUN_LINK, id, 'initializing state')
    try {
      await state.initialize({ bundle: app.bundle, app })
      LOG.info(LOG_RUN_LINK, id, 'state initialized')
    } catch (err) {
      LOG.error(
        [...LOG_RUN_LINK, 'internal'],
        'Failed to initialize state for app id',
        id,
        err
      )
      if (err.code === 'ERR_INVALID_MANIFEST')
        throw ERR_CONNECTION(err.message, { err })
      throw err
    }

    LOG.info(LOG_RUN_LINK, id, 'determining assets')
    state.update({ assets: await app.bundle.assets(state.manifest) })

    LOG.info(LOG_RUN_LINK, id, 'assets', state.assets)

    if (flags.preflight) return { bail: { code: 'PREFLIGHT' } }

    if (app.bundle.platformVersion !== null) {
      app.report({ type: 'upgrade' })
      LOG.info(LOG_RUN_LINK, id, 'app bundling..')
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'app bundling..')
    const bundle = await app.bundle.bundle(state.entrypoint)
    LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
    return { id, startId, bundle }
    // start is tied to the lifecycle of the client itself so we don't tear it down
  }

  async asset(opts, corestore) {
    LOG.info(this.LOG_RUN_LINK, 'getting asset', opts.link.slice(0, 14) + '..')

    let asset = await this.sidecar.model.getAsset(opts.link)
    if (asset !== null) return asset

    asset = {
      ...opts,
      path: path.join(PLATFORM_DIR, 'assets', randomBytes(16).toString('hex'))
    }

    LOG.info(this.LOG_RUN_LINK, 'syncing asset', asset.link.slice(0, 14) + '..')
    const parsed = plink.parse(asset.link)

    const dst = new LocalDrive(asset.path)
    const key = parsed.drive.key
    let src = null
    try {
      src = new Hyperdrive(corestore, key)
      await src.ready()
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
    }
    const bundle = new Bundle({
      key,
      corestore,
      drive: src,
      checkout: parsed.drive.length,
      swarm: this.sidecar.swarm
    })
    await this.session.add(bundle)
    bundle.join()
    const monitor = new DriveMonitor(bundle.drive)
    this.on('end', () => monitor.destroy())
    monitor.on('error', (err) =>
      this.push({ tag: 'assetStatsErr', data: { err } })
    )
    monitor.on('data', (stats) => this.push({ tag: 'assetStats', data: stats }))
    this.push({
      tag: 'assetSyncing',
      data: { link: asset.link, dir: asset.path }
    })
    try {
      await bundle.calibrate()
    } catch (err) {
      await this.session.close()
      throw err
    }
    let only = opts.only
    let select = null
    if (only) {
      only = (Array.isArray(only) ? only : only.split(',')).map((s) =>
        s.trim().replace(/%%HOST%%/g, require.addon.host)
      )
      select = (key) =>
        only.some((path) => key.startsWith(path[0] === '/' ? path : '/' + path))
    }
    const mirror = src.mirror(dst, { filter: select })
    for await (const diff of mirror) {
      LOG.trace(this.LOG_RUN_LINK, 'asset syncing', diff)
      if (diff.op === 'add') {
        this.push({
          tag: 'byteDiff',
          data: { type: 1, sizes: [diff.bytesAdded], message: diff.key }
        })
      } else if (diff.op === 'change') {
        this.push({
          tag: 'byteDiff',
          data: {
            type: 0,
            sizes: [-diff.bytesRemoved, diff.bytesAdded],
            message: diff.key
          }
        })
      } else if (diff.op === 'remove') {
        this.push({
          tag: 'byteDiff',
          data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key }
        })
      }
    }
    await this.sidecar.model.addAsset(opts.link, asset)
    LOG.info(this.LOG_RUN_LINK, 'synced asset', asset.link.slice(0, 14) + '..')
    return asset
  }

  #gcOrphanWorkers() {
    try {
      for (const client of this.sidecar.clients) {
        const userData = client.userData
        if (!userData) continue
        if (
          userData.state &&
          userData.state.pid &&
          userData.state.parent &&
          !this.sidecar.apps.some(
            (app) => app.state.parent === userData.state.parent
          )
        ) {
          try {
            LOG.trace(
              this.LOG_RUN_LINK,
              'Killing orphan worker process with PID',
              userData.state.pid
            )
            os.kill(userData.state.pid, 'SIGKILL')
          } catch (err) {
            LOG.error('internal', 'Error killing orphan worker', err)
          }
        }
      }
    } catch (err) {
      LOG.error('internal', 'gc orphan workers error', err)
    }
  }

  async #updatePearInterface(drive) {
    try {
      const pkgEntry = await drive.entry('/package.json')
      if (pkgEntry === null) return
      const pkg = JSON.parse(await drive.get(pkgEntry))
      const isDevDep = !!pkg.devDependencies?.['pear-interface']
      if (isDevDep === false) return
      const pearInterfacePkgEntry = await drive.entry(
        '/node_modules/pear-interface/package.json'
      )
      if (pearInterfacePkgEntry === null) return
      const projPkg = JSON.parse(await drive.get(pearInterfacePkgEntry))
      const platPkg = JSON.parse(
        await this.sidecar.drive.get(
          '/node_modules/pear-interface/package.json'
        )
      )
      if (projPkg.version === platPkg.version) return
      const tmp = path.join(drive.root, 'node_modules', '.pear-interface.next')
      const mirror = this.sidecar.drive.mirror(new LocalDrive(tmp), {
        prefix: '/node_modules/pear-interface'
      })
      await mirror.done()
      const next = path.join(tmp, 'node_modules', 'pear-interface')
      const current = path.join(drive.root, 'node_modules', 'pear-interface')
      await fsx.swap(next, current)
      await fs.promises.rm(tmp, { recursive: true })
    } catch (err) {
      LOG.error(
        'internal',
        'Unexpected error while attempting to update pear-interface in project',
        drive.root,
        err
      )
    }
  }
}
