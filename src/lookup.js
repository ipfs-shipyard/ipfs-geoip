import { default as memoize } from 'p-memoize'
import ip from 'ip'
import * as dagCbor from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { formatData } from './format.js'

export const GEOIP_ROOT = CID.parse('bafyreihpmffy4un3u3qstv5bskxmdekdzydujbbephdwhshrgbrecjnqme') // GeoLite2-City-CSV_20220628

const defaultGateway = 'https://ipfs.io'

/**
 * @param {object|string} ipfs
 * @param {CID} cid
 * @returns {Promise}
 */
async function getRawBlock (ipfs, cid) {
  // normalize to string
  let gwUrl
  try {
    gwUrl = new URL(ipfs || defaultGateway)
    gwUrl.pathname = `/ipfs/${cid.toString()}`
    gwUrl.search = '?format=raw'
    const rawBlock = await fetch(gwUrl, { cache: 'force-cache' })
    return new Uint8Array(await rawBlock.arrayBuffer())
  } catch (_) {
    // not a gateway URL, fallbck to using it as Core JS API
    // (this is backward-compatibility for legacy users)
    return await ipfs.block.get(cid)
  }
}

/**
 * @param {object|string} ipfs
 * @param {CID} cid
 * @param {string} lookfor - ip
 * @returns {Promise}
 */
async function _lookup (ipfs, cid, lookfor) {
  let obj
  try {
    const block = await getRawBlock(ipfs, cid)
    obj = await dagCbor.decode(block)
  } catch (e) {
    // log error, this makes things waaaay easier to fix in case API changes again
    console.error(`[ipfs-geoip] failed to get and parse DAG-CBOR for CID '${cid}'`, e) // eslint-disable-line no-console
    throw e
  }

  let child = 0

  if (!('data' in obj)) { // regular node
    while (obj.mins[child] && obj.mins[child] <= lookfor) {
      child++
    }

    const next = obj.links[child - 1]

    if (!next) {
      throw new Error('Failed to lookup node')
    }

    const nextCid = getCid(next)

    if (!nextCid) {
      throw new Error('Failed to lookup node')
    }

    return memoizedLookup(ipfs, nextCid, lookfor)
  } else if ('data' in obj) { // leaf node
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
 * @param {object} ipfs
 * @param {string} ipstring
 * @returns {Promise}
 */
export function lookup (ipfs, ipstring) {
  return memoizedLookup(ipfs, GEOIP_ROOT, ip.toLong(ipstring))
}

function getCid (node) {
  if (!node) return null
  return CID.asCID(node)
}
