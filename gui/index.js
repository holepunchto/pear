'use strict'
module.exports = process.type === 'renderer' ? require('./preload') : require('./gui')
