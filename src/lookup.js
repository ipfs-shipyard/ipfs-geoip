'use strict'

const memoize = require('memoizee')
const inet = require('inet_ipv4')
const mh = require('multihashes')

const formatData = require('./format')

const GEOIP_ROOT = mh.fromB58String('QmRn43NNNBEibc6m7zVNcS6UusB1u3qTTfyoLmkugbeeGJ')

let memoizedLookup

/**
 * @param {Object} ipfs
 * @param {string} hash
 * @param {string} lookfor - ip
 * @returns {Promise}
 */
function _lookup (ipfs, hash, lookfor) {
  return new Promise((resolve, reject) => {
    ipfs.object.get(hash, (err, res) => {
      if (err) reject(err)

      let obj
      try {
        obj = JSON.parse(res.data)
      } catch (err) {
        reject(err)
      }

      let child = 0

      if (obj.type === 'Node') {
        while (obj.mins[child] && obj.mins[child] <= lookfor) {
          child++
        }

        const next = res.links[child - 1]

        if (!next) {
          reject(new Error('Failed to lookup node'))
        }

        const nextCid = getCid(next)

        if (!nextCid) {
          reject(new Error('Failed to lookup node'))
        }

        resolve(memoizedLookup(ipfs, nextCid, lookfor))
      } else if (obj.type === 'Leaf') {
        while (obj.data[child] && obj.data[child].min <= lookfor) {
          child++
        }

        const next = obj.data[child - 1]

        if (!next) {
          reject(new Error('Failed to lookup leaf node'))
        }

        if (!next.data) {
          reject(new Error('Unmapped range'), null)
        }

        resolve(formatData(next.data))
      }
    })
  })
}

memoizedLookup = memoize(_lookup, { async: true })

/**
 * @param {Object} ipfs
 * @param {string} ip
 * @returns {Promise}
 */
module.exports = function lookup (ipfs, ip) {
  return memoizedLookup(ipfs, GEOIP_ROOT, inet.aton(ip))
}

function getCid (node) {
  if (!node) return null
  // Handle ipfs-api < 27.0.0
  if (node.multihash) return node.multihash
  // Handle ipfs-http-client >= 27.0.0
  if (node.cid) return node.cid.toString()
  return null
}
