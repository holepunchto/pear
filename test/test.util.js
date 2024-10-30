'use strict'
function promiseToComplete () {
  let resolveFn
  let rejectFn
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })
  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn
  }
}

module.exports = {
  promiseToComplete
}
