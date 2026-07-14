'use strict'
const diagnostics = require('../lib/diagnostics.js')
const Logger = require('../lib/logger.js')
const { ansi, byteSize, print } = require('../lib/terminal.js')

module.exports = async function logs(cmd) {
  const json = hasFlag(cmd, 'json')
  const action = cmd.command.name

  if (action === 'clear') {
    await diagnostics.clear()
    if (json) console.log(JSON.stringify({ logs: { cleared: true } }))
    else print('Logs cleared', true)
    return
  }

  if (action === 'bundle') {
    const result = await diagnostics.bundle(cmd.args.dir)
    if (json) console.log(JSON.stringify({ logs: result }))
    else print(formatBundle(result), true)
    return
  }

  const info = diagnostics.snapshot(Logger.switches.logFile)
  if (json) console.log(JSON.stringify({ logs: info }))
  else print(formatInfo(info))
}

function formatInfo(info) {
  const files = info.files.length
    ? info.files.map((file) => `  ${file.path} ${ansi.dim(byteSize(file.bytes))}`).join('\n')
    : `  ${ansi.dim('[ No log files ]')}`

  return [
    '',
    `${ansi.bold('Platform')} ${info.platformDir}`,
    `${ansi.bold('Logs')} ${info.logsDir}`,
    '',
    `${ansi.bold('Write runtime logs')}`,
    `  pear --log --log-file ${info.logFile} <cmd>`,
    '',
    `${ansi.bold('Crash logs')}`,
    `  CLI      ${info.crashLogs.cli}`,
    `  Sidecar  ${info.crashLogs.sidecar}`,
    '',
    `${ansi.bold('Files')}`,
    files,
    ''
  ].join('\n')
}

function formatBundle(result) {
  const files = result.files.length
    ? `${result.files.length} file${result.files.length === 1 ? '' : 's'} copied`
    : 'No log files found'
  return `${files}\n${result.path}`
}

function hasFlag(cmd, name) {
  for (let c = cmd.command; c; c = c.parent) {
    if (c.flags?.[name]) return true
  }
  return false
}
