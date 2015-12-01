'use strict'

var memoize = require('memoizee')

var formatData = require('./format')
var aton4 = require('./aton4')

var GEOIP_ROOT = 'QmQQ3BUpPjgYiTdhp4H9YWSCtoFXs8t91njhpvXNNLd3yB'

var memoized_lookup

function _lookup (ipfs, hash, lookfor, cb) {
  ipfs.object.get(hash, function (err, res) {
    if (err) {
      return cb(err, null)
    }

    try {
      var obj = JSON.parse(res.Data)
    } catch (err) {
      return cb(err, null)
    }

    var child = 0
    if (obj.type === 'Node') {
      while (obj.mins[child] &&
             obj.mins[child] <= lookfor) {
        child++
      }
      return memoized_lookup(ipfs, res.Links[child - 1].Hash, lookfor, cb)
    } else if (obj.type === 'Leaf') {
      while (obj.data[child] &&
             obj.data[child].min <= lookfor) {
        child++
      }

      if (obj.data[child - 1].data) {
        cb(null, formatData(obj.data[child - 1].data))
      } else {
        cb('Unmapped range', null)
      }
    }
  })
}

memoized_lookup = memoize(_lookup, {async: true})

function lookup (ipfs, ip, cb) {
  memoized_lookup(ipfs, GEOIP_ROOT, aton4(ip), cb)
}

function lookup_root (ipfs, hash, ip, cb) {
  memoized_lookup(ipfs, hash, aton4(ip), cb)
}

module.exports = {
  lookup: lookup,
  lookup_root: lookup_root,
  _lookup: memoized_lookup
}
