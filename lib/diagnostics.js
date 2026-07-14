'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { arch, platform } = require('which-runtime')
const { PLATFORM_DIR, UPGRADE, VERSION } = require('../constants.js')

const LOGS_DIR = path.join(PLATFORM_DIR, 'logs')
const DEFAULT_LOG_FILE = path.join(LOGS_DIR, 'pear.log')

function ensureDir(dir = LOGS_DIR) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function resolveLogFile(file) {
  if (!file) return ''
  return path.resolve(file)
}

function crashLogPath(name) {
  return path.join(LOGS_DIR, `${name}.crash.log`)
}

function append(file, msg) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, msg, { flag: 'a', encoding: 'utf8' })
}

function list() {
  try {
    return fs
      .readdirSync(LOGS_DIR)
      .map((name) => {
        const file = path.join(LOGS_DIR, name)
        const stat = fs.statSync(file)
        return stat.isFile() ? { name, path: file, bytes: stat.size } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function bundle(dir) {
  const target = path.resolve(dir || `pear-logs-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  const files = list()

  await fs.promises.mkdir(target, { recursive: true })

  for (const file of files) {
    await fs.promises.copyFile(file.path, path.join(target, file.name))
  }

  return { path: target, files }
}

async function clear() {
  await fs.promises.rm(LOGS_DIR, { recursive: true }).catch(() => {})
}

function snapshot(logFile = '') {
  return {
    platformDir: PLATFORM_DIR,
    logsDir: LOGS_DIR,
    logFile: logFile || DEFAULT_LOG_FILE,
    crashLogs: {
      cli: crashLogPath('cli'),
      sidecar: crashLogPath('sidecar')
    },
    runtime: {
      version: VERSION,
      upgrade: UPGRADE,
      bare: Bare.versions.bare,
      platform,
      arch,
      pid: Bare.pid
    },
    files: list()
  }
}

module.exports = {
  LOGS_DIR,
  DEFAULT_LOG_FILE,
  append,
  bundle,
  clear,
  crashLogPath,
  ensureDir,
  list,
  resolveLogFile,
  snapshot
}
