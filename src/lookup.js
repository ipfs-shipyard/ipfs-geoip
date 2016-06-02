'use strict'

const memoize = require('memoizee')
const inet = require('inet_ipv4')

const formatData = require('./format')

const GEOIP_ROOT = 'QmRn43NNNBEibc6m7zVNcS6UusB1u3qTTfyoLmkugbeeGJ'

let memoized_lookup

function _lookup (ipfs, hash, lookfor, cb) {
  ipfs.object.get(hash, {enc: 'base58'}, (err, res) => {
    if (err) return cb(err)

    let obj
    try {
      obj = JSON.parse(res.data)
    } catch (err) {
      return cb(err)
    }

    let child = 0

    if (obj.type === 'Node') {
      while (obj.mins[child] && obj.mins[child] <= lookfor) {
        child++
      }

      const next = res.links[child - 1]

      if (!next || !next.Hash) {
        return cb(new Error('Failed to lookup node'))
      }

      return memoized_lookup(ipfs, next.Hash, lookfor, cb)
    } else if (obj.type === 'Leaf') {
      while (obj.data[child] && obj.data[child].min <= lookfor) {
        child++
      }

      const next = obj.data[child - 1]

      if (!next) {
        return cb(new Error('Failed to lookup leaf node'))
      }

      if (!next.data) {
        return cb(new Error('Unmapped range'), null)
      }

      return cb(null, formatData(next.data))
    }
  })
}

memoized_lookup = memoize(_lookup, {async: true})

module.exports = function lookup (ipfs, ip, cb) {
  memoized_lookup(ipfs, GEOIP_ROOT, inet.aton(ip), cb)
}
