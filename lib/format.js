'use strict'

function formatDuration(ms) {
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  let str = ''
  if (days) str += `${days}d `
  if (hours || days) str += `${hours}h `
  if (minutes || hours || days) str += `${minutes}m `
  str += `${seconds}s`
  return str
}

module.exports = { formatDuration }
