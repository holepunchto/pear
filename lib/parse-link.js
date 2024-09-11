'use strict'
const constants = require('../constants')
const { ERR_INVALID_LINK } = require('../errors')
const pearLink = require('pear-link')
const parse = pearLink(constants.ALIASES, () => { throw new ERR_INVALID_LINK() })
module.exports = parse
