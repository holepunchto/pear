'use strict'
const { command, arg, rest, sloppy } = require('paparam')
module.exports = (argv, loose = false) => {
  const def = [...require('../def/pear')]
  if (loose) def.unshift(sloppy({ flags: true }))
  return command('pear', ...def, arg('<cmd>'), rest('rest')).parse(argv).flags
}
