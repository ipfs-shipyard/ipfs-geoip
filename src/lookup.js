'use strict'

const memoize = require('p-memoize')
const ip = require('ip')
const CID = require('cids')

const formatData = require('./format')

const GEOIP_ROOT = new CID('Qmbt1YbZAhMoqo7r1t6Y5EJrYGVRgcaisNAZhLeJY6ehfg') // GeoLite2-City-CSV_20201013

/**
 * @param {Object} ipfs
 * @param {CID} cid
 * @param {string} lookfor - ip
 * @returns {Promise}
 */
async function _lookup (ipfs, cid, lookfor) {
  // ensure input is a valid cid, but switch to string representation
  // to avoid serialization issues when mix of cids >1.0 and <1.0 are used
  cid = new CID(cid).toString()
  const res = await ipfs.object.get(cid)

  // TODO: use dag-cbor instead of stringified JSON
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

const memoizedLookup = memoize(_lookup, {
  cachePromiseRejection: false,
  cacheKey: args => {
    // cache based on cid+ip: we ignore first argument, which is ipfs api instance
    const [, cid, lookfor] = args
    return `${cid}.${lookfor}`
  }
})

/**
 * @param {Object} ipfs
 * @param {string} ipstring
 * @returns {Promise}
 */
module.exports = function lookup (ipfs, ipstring) {
  return memoizedLookup(ipfs, GEOIP_ROOT, ip.toLong(ipstring))
}

function getCid (node) {
  if (!node) return null
  if (node.Hash) return node.Hash
  return null
}
