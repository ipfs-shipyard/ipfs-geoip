import { decode as dagCborDecode } from '@ipld/dag-cbor'
import fetch from 'cross-fetch'
import ip from 'ip'
import { CID } from 'multiformats/cid'
import { default as memoize } from 'p-memoize'
import { MAX_LOOKUP_RETRIES } from './constants.js'
import { formatData } from './format.js'

export const GEOIP_ROOT = CID.parse('bafyreif3tfdpr5n4jdrbielmcapwvbpcthepfkwq2vwonmlhirbjmotedi') // b-tree version of GeoLite2-City-CSV_20231117

const defaultGateway = ['https://ipfs.io', 'https://dweb.link']

/**
 * @param {object|string} ipfs
 * @param {CID} cid
 * @returns {Promise}
 */
async function getRawBlock (ipfs, cid) {
  if (typeof ipfs === 'function') {
    return ipfs(cid)
  }
  if (typeof ipfs?.block?.get === 'function') {
    // use Core JS API (https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/BLOCK.md)
    return ipfs.block.get(cid)
  }

  // Assume ipfs is gateway url or a list of gateway urls to try in order
  const gateways = Array.isArray(ipfs) ? ipfs : [ipfs]
  for (const url of gateways) { // eslint-disable-line no-unreachable-loop
    const gwUrl = new URL(url)
    gwUrl.pathname = `/ipfs/${cid.toString()}`
    gwUrl.search = '?format=raw' // necessary as not every gateway supports dag-cbor, but every should support sending raw block as-is
    try {
      const res = await fetch(gwUrl, {
        headers: {
          // also set header, just in case ?format= is filtered out by some reverse proxy
          Accept: 'application/vnd.ipld.raw'
        },
        cache: 'force-cache'
      })
      if (!res.ok) throw res
      return new Uint8Array(await res.arrayBuffer())
    } catch (cause) {
      throw new Error(`unable to fetch raw block for CID ${cid}`, { cause })
    }
  }
}

/**
 * Gets Obj and Block after retrying multiple times.
 *
 * @param {object|string} ipfs
 * @param {CID} cid
 * @param {number} numTry - this will be 1 for the first try and recurse till MAX_LOOKUP_RETRIES is reached.
 * @returns {Promise<{obj, block}>}
 */
async function getObjAndBlockWithRetries (ipfs, cid, numTry = 1) {
  try {
    const block = await getRawBlock(ipfs, cid)
    const obj = await dagCborDecode(block)
    return { obj, block }
  } catch (e) {
    if (numTry < MAX_LOOKUP_RETRIES) {
      return await getObjAndBlockWithRetries(ipfs, cid, numTry + 1)
    }
    throw e
  }
}

/**
 * @param {object|string} ipfs
 * @param {CID} cid
 * @param {string} lookfor - ip
 * @returns {Promise}
 */
async function _lookup (ipfs, cid, lookfor) {
  let obj, block
  try {
    ({ obj, block } = await getObjAndBlockWithRetries(ipfs, cid))
  } catch (e) {
    if (process?.env?.DEBUG || process?.env?.TEST) {
      if (!block) {
        console.error(`[ipfs-geoip] failed to get raw block for CID '${cid}'`, e) // eslint-disable-line no-console
      } else {
        console.error(`[ipfs-geoip] failed to parse DAG-CBOR behind CID '${cid}'`, e) // eslint-disable-line no-console
      }
    }
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
export function lookup (ipfs = defaultGateway, ipstring) {
  return memoizedLookup(ipfs, GEOIP_ROOT, ip.toLong(ipstring))
}

function getCid (node) {
  if (!node) return null
  return CID.asCID(node)
}
