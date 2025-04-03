'use strict'
const { command, arg, rest } = require('paparam')
const def = [...require('./def/pear')]
module.exports = (argv) => command('pear', ...def, arg('<cmd>'), rest('rest')).parse(argv, { silent: true, sync: true })
