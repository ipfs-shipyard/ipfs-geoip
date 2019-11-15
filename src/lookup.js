'use strict'

const memoize = require('memoizee')
const inet = require('inet_ipv4')
const mh = require('multihashes')

const formatData = require('./format')

const GEOIP_ROOT = mh.fromB58String('QmRn43NNNBEibc6m7zVNcS6UusB1u3qTTfyoLmkugbeeGJ')

/**
 * @param {Object} ipfs
 * @param {string} hash
 * @param {string} lookfor - ip
 * @returns {Promise}
 */
async function _lookup (ipfs, hash, lookfor) {
  const res = await ipfs.object.get(hash)
  const obj = JSON.parse(res.Data)
  let child = 0

  if (obj.type === 'Node') {
    while (obj.mins[child] && obj.mins[child] <= lookfor) {
      child++
    }

    const next = res.Links[child - 1]

    if (!next) {
      throw new Error('Failed to lookup node')
    }

    const nextCid = getCid(next)

    if (!nextCid) {
      throw new Error('Failed to lookup node')
    }

    return memoizedLookup(ipfs, nextCid, lookfor)
  } else if (obj.type === 'Leaf') {
    while (obj.data[child] && obj.data[child].min <= lookfor) {
      child++
    }

    const next = obj.data[child - 1]

    if (!next) {
      throw new Error('Failed to lookup leaf node')
    }

    if (!next.data) {
      throw new Error('Unmapped range')
    }

    return formatData(next.data)
  }
}

const memoizedLookup = memoize(_lookup, { async: true })

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
  if (node.Hash) return node.Hash.toString()
  return null
}
