'use strict'

var lookup = require('./lookup').lookup

function isLocal (address) {
  var split = address.split('.')
  if (split[0] === '10') return true
  if (split[0] === '127') return true
  if (split[0] === '192' && split[1] === '168') return true
  if (split[0] === '172' && +split[1] >= 16 && +split[1] <= 31) return true
  return false
}

module.exports = function lookupPretty (ipfs, multiaddrs, cb) {
  if (multiaddrs.length === 0) return cb(null, null)
  if (typeof multiaddrs === 'string') multiaddrs = [multiaddrs]

  var address = multiaddrs[0].split('/')[2]
  if (isLocal(address)) return lookupPretty(ipfs, multiaddrs.slice(1), cb)

  lookup(ipfs, address, function (err, res) {
    if (err) return cb(err)

    if (!res.country_name && multiaddrs.length > 1) {
      return lookupPretty(ipfs, multiaddrs.slice(1), cb)
    }

    var location = []

    if (res.planet) location.push(res.planet)
    if (res.country_name) location.unshift(res.country_name)
    if (res.region_code) location.unshift(res.region_code)
    if (res.city) location.unshift(res.city)

    res.formatted = location.join(', ')

    cb(null, res)
  })
}
