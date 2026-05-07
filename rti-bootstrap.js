'use strict'

module.exports = function bootstrapRTI(mount = null) {
  if (global.Pear?.constructor?.RTI?.checkout) return global.Pear

  const rti = mount
    ? { checkout: require('./checkout'), mount }
    : { checkout: require('./checkout') }

  global.Pear = {
    constructor: { RTI: rti },
    config: {}
  }

  return global.Pear
}
