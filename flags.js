'use strict'
const { command, arg, rest} = require('paparam')
module.exports = () => command('pear', ...require('./def/pear'), arg('<cmd>'), rest('rest')).parse(Bare.argv.slice(2)).flags