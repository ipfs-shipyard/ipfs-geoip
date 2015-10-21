'use strict'

module.exports = function aton4 (a) {
  a = a.split(/\./)

  return ((parseInt(a[0], 10) << 24) >>> 0) +
    ((parseInt(a[1], 10) << 16) >>> 0) +
    ((parseInt(a[2], 10) << 8) >>> 0) +
    (parseInt(a[3], 10) >>> 0)
}
