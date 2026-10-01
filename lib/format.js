'use strict'

function formatDuration(ms) {
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  let result = ''
  if (days) result += `${days}d `
  if (hours || days) result += `${hours}h `
  if (minutes || hours || days) result += `${minutes}m `
  result += `${seconds}s`
  return result
}

module.exports = { formatDuration }
