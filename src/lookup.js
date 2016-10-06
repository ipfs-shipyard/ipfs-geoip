'use strict'

const memoize = require('memoizee')
const inet = require('inet_ipv4')
const mh = require('multihashes')

const formatData = require('./format')

const GEOIP_ROOT = mh.fromB58String('QmRn43NNNBEibc6m7zVNcS6UusB1u3qTTfyoLmkugbeeGJ')

let memoizedLookup

function _lookup (ipfs, hash, lookfor, cb) {
  ipfs.object.get(hash, (err, res) => {
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

      if (!next || !next.hash) {
        return cb(new Error('Failed to lookup node'))
      }

      return memoizedLookup(ipfs, next.hash, lookfor, cb)
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

memoizedLookup = memoize(_lookup, {async: true})

module.exports = function lookup (ipfs, ip, cb) {
  memoizedLookup(ipfs, GEOIP_ROOT, inet.aton(ip), cb)
}
