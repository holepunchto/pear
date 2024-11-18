'use strict'
const constants = require('pear-api/constants')
const { ERR_INVALID_LINK } = require('../errors')
const pearLink = require('pear-link')
const parse = pearLink(constants.ALIASES, ERR_INVALID_LINK)
module.exports = parse
