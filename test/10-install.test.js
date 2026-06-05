'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')
const env = require('bare-env')
const { spawn, spawnSync } = require('bare-subprocess')
const LocalDrive = require('localdrive')
const pearBuild = require('pear-build')
const { platform, arch, isWindows, isLinux } = require('which-runtime')
const Helper = require('./helper')

const npm = isWindows ? 'npm.cmd' : 'npm'
const pearDev = isWindows ? 'pear.dev.cmd' : './pear.dev'
const pearExe = isWindows ? 'pear.exe' : 'pear'
const host = `${platform}-${arch}`

test(
  'install pear and run smoke tests',
  { skip: !isLinux || isWindows || env.GITHUB_ACTIONS !== 'true' || env.PEAR_INSTALL_E2E !== '1' },
  async function (t) {
    t.timeout(900_000)

    const dir = await fs.promises.mkdtemp(path.join(Helper.tmp, 'pear-install-e2e-'))
    const pearDir = path.join(dir, 'pear')
    const buildDir = path.join(pearDir, 'out', 'build')
    const homeDir = path.join(dir, 'home')
    const installedPear = path.join(defaultBinDir(homeDir), pearExe)
    const existingSidecars = pearSidecarPids()
    const childEnv = {
      ...env,
      HOME: homeDir,
      PATH: `${defaultBinDir(homeDir)}${path.delimiter}${env.PATH || ''}`
    }

    await fs.promises.mkdir(homeDir, { recursive: true })
    t.teardown(() => cleanupProcesses(dir, homeDir, existingSidecars))
    t.teardown(() => Helper.gc(dir), { order: Infinity })

    t.comment('copy pear checkout')
    await new LocalDrive(Helper.localDir)
      .mirror(new LocalDrive(pearDir), {
        prune: false,
        ignore: ['/pear', '/.git', '/node_modules', '/by-arch', '/current']
      })
      .done()

    t.comment('install pear dependencies')
    await exec(t, npm, ['install'], { cwd: pearDir, env: childEnv })

    t.comment('touch pear upgrade link')
    const touch = await exec(t, pearDev, ['touch', '--json'], { cwd: pearDir, env: childEnv })
    const link = findJson(touch.stdout, 'touch', 'final')?.data?.link
    t.ok(link, `touched ${link}`)

    t.comment('replace package upgrade links')
    const pkgPath = path.join(pearDir, 'package.json')
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'))
    pkg.upgrade.production = link
    pkg.upgrade.dev = link
    pkg.upgrade.stage = link
    await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    t.comment('make pear')
    await exec(t, npm, ['run', 'make'], { cwd: pearDir, env: childEnv })

    t.comment('run pear-build')
    await pearBuild({
      package: pkgPath,
      [`${platform}${arch[0].toUpperCase() + arch.slice(1)}App`]: path.join(
        pearDir,
        'by-arch',
        host,
        'bin',
        pearExe
      ),
      target: buildDir
    }).done()

    t.comment('stage build')
    const stage = await exec(t, pearDev, ['stage', link, buildDir, '--json'], {
      cwd: pearDir,
      env: childEnv
    })
    t.ok(findJson(stage.stdout, 'stage', 'final')?.data?.success, 'staged successfully')

    t.comment('seed build')
    const seed = spawn(pearDev, ['seed', link, '--json', '--no-tty'], {
      cwd: pearDir,
      env: childEnv,
      detached: !isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    seed.killGroup = !isWindows
    t.teardown(() => terminate(seed))
    await waitForJson(seed, 'seed', 'announced')

    t.comment('install pear')
    const install = await exec(t, pearDev, ['install', '--json', link], {
      cwd: pearDir,
      env: childEnv
    })
    t.ok(findJson(install.stdout, 'install', 'final')?.data?.success, 'installed successfully')
    t.ok(fs.existsSync(installedPear), `installed ${installedPear}`)

    t.comment('run installed pear smoke tests')
    const versions = await exec(t, installedPear, ['versions', '--json'], {
      cwd: dir,
      env: childEnv
    })
    t.ok(findJson(versions.stdout, 'versions', 'libraries'), 'versions reported libraries')

    const help = await exec(t, installedPear, ['help'], { cwd: dir, env: childEnv })
    t.ok(help.stdout.includes('pear'), 'help printed')

    t.comment('boot installed sidecar')
    const sidecar = spawn(installedPear, ['sidecar'], {
      cwd: dir,
      env: childEnv,
      detached: !isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    sidecar.killGroup = !isWindows
    t.teardown(() => terminate(sidecar))
    t.teardown(() => shutdownSidecar(t, installedPear, { cwd: dir, env: childEnv }))
    const boot = await waitForOutput(sidecar, /Current process is now Sidecar|Sidecar Booting/)
    t.ok(boot, 'sidecar booted')

    await shutdownSidecar(t, installedPear, { cwd: dir, env: childEnv })
    await terminate(sidecar)
    await terminate(seed)
    await cleanupProcesses(dir, homeDir, existingSidecars)
  }
)

function defaultBinDir(homeDir) {
  return platform === 'darwin'
    ? path.join('/', 'usr', 'local', 'bin')
    : path.join(homeDir, '.local', 'bin')
}

function exec(t, cmd, args, opts = {}) {
  const timeout = opts.timeout || 300_000
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const timer = setTimeout(() => {
      terminate(child)
      reject(new Error(`Timed out: ${cmd} ${args.join(' ')}`))
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data
    })
    child.stderr.on('data', (data) => {
      stderr += data
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) return resolve({ stdout, stderr })
      t.comment(stdout)
      t.comment(stderr)
      reject(new Error(`${cmd} ${args.join(' ')} exited with ${code || signal}`))
    })
  })
}

function findJson(stdout, cmd, tag) {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if (parsed.cmd === cmd && parsed.tag === tag) return parsed
  }
  return null
}

function waitForJson(child, cmd, tag, timeout = 120_000) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for ${cmd}:${tag}\n${stdout}\n${stderr}`))
    }, timeout)
    const cleanup = () => {
      clearTimeout(timer)
      child.stdout.off('data', onstdout)
      child.stderr.off('data', onstderr)
      child.off('exit', onexit)
      child.off('error', onerror)
    }
    const onstdout = (data) => {
      stdout += data
      const found = findJson(stdout, cmd, tag)
      if (!found) return
      cleanup()
      resolve(found.data)
    }
    const onstderr = (data) => {
      stderr += data
    }
    const onexit = (code, signal) => {
      cleanup()
      reject(new Error(`${cmd} exited before ${tag}: ${code || signal}\n${stdout}\n${stderr}`))
    }
    const onerror = (err) => {
      cleanup()
      reject(err)
    }
    child.stdout.on('data', onstdout)
    child.stderr.on('data', onstderr)
    child.on('exit', onexit)
    child.on('error', onerror)
  })
}

function waitForOutput(child, pattern, timeout = 120_000) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for ${pattern}\n${output}`))
    }, timeout)
    const cleanup = () => {
      clearTimeout(timer)
      child.stdout.off('data', ondata)
      child.stderr.off('data', ondata)
      child.off('exit', onexit)
      child.off('error', onerror)
    }
    const ondata = (data) => {
      output += data
      if (!pattern.test(output)) return
      cleanup()
      resolve(output)
    }
    const onexit = (code, signal) => {
      cleanup()
      reject(new Error(`Process exited before output matched: ${code || signal}\n${output}`))
    }
    const onerror = (err) => {
      cleanup()
      reject(err)
    }
    child.stdout.on('data', ondata)
    child.stderr.on('data', ondata)
    child.on('exit', onexit)
    child.on('error', onerror)
  })
}

async function terminate(child) {
  if (!child || child.exitCode !== null) return
  signal(child, 'SIGTERM')
  const exited = await waitForExit(child, 5000)
  if (exited) return
  signal(child, 'SIGKILL')
  await waitForExit(child, 5000)
}

function signal(child, name) {
  const pid = child.pid
  if (!pid) return
  try {
    if (child.killGroup) os.kill(-pid, name)
    else child.kill(name)
  } catch {}
}

function waitForExit(child, timeout) {
  if (child.exitCode !== null) return true
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off('exit', onexit)
      resolve(false)
    }, timeout)
    const onexit = () => {
      clearTimeout(timer)
      resolve(true)
    }
    child.once('exit', onexit)
  })
}

async function shutdownSidecar(t, cmd, opts) {
  try {
    await exec(t, cmd, ['sidecar', 'shutdown'], { ...opts, timeout: 30_000 })
  } catch {}
}

async function cleanupProcesses(dir, homeDir, existingSidecars) {
  const pids = new Set()
  collectMatchingPids(pids, dir)
  collectOpenFilePids(pids, homeDir)
  collectNewSidecarPids(pids, existingSidecars)
  pids.delete(String(Bare.pid))

  for (const pid of pids) killPid(pid, 'SIGTERM')
  if (pids.size > 0) await new Promise((resolve) => setTimeout(resolve, 1000))
  for (const pid of pids) killPid(pid, 'SIGKILL')
}

function collectMatchingPids(pids, dir) {
  const ps = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
  if (ps.status !== 0) return
  for (const line of ps.stdout.toString().split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.*)$/)
    if (!match) continue
    if (match[2].includes(dir)) pids.add(match[1])
  }
}

function collectOpenFilePids(pids, dir) {
  const lsof = spawnSync('lsof', ['-t', '+D', dir], { encoding: 'utf8' })
  if (lsof.status !== 0 && lsof.status !== 1) return
  for (const line of lsof.stdout.toString().split(/\r?\n/)) {
    if (/^\d+$/.test(line)) pids.add(line)
  }
}

function collectNewSidecarPids(pids, existing) {
  for (const pid of pearSidecarPids()) {
    if (!existing.has(pid)) pids.add(pid)
  }
}

function pearSidecarPids() {
  const pids = new Set()
  const ps = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
  if (ps.status !== 0) return pids
  for (const line of ps.stdout.toString().split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/)
    if (match && match[2].trim() === 'pear-sidecar') pids.add(match[1])
  }
  return pids
}

function killPid(pid, signal) {
  try {
    os.kill(Number(pid), signal)
  } catch {}
}
