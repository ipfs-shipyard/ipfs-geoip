import { decode as dagCborDecode } from '@ipld/dag-cbor'
import fetch from 'cross-fetch'
import { CID } from 'multiformats/cid'
import { default as memoize } from 'p-memoize'
import { MAX_LOOKUP_RETRIES } from './constants.js'
import { formatData } from './format.js'
import { ipToUint128, uint128ToBytes } from './ip.js'

export const GEOIP_ROOT = CID.parse('bafyreianvcooqkxfwq5kqy37qroncwn4qzj7guj425kekxnylmtdupmzbq') // GeoLite2-City-CSV_20250218

const defaultGateway = ['https://trustless-gateway.link', 'https://ipfs.io', 'https://dweb.link']

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
    return ipfs.block.get(cid)
  }

  const gateways = Array.isArray(ipfs) ? ipfs : [ipfs]
  for (const url of gateways) { // eslint-disable-line no-unreachable-loop
    const gwUrl = new URL(url)
    gwUrl.pathname = `/ipfs/${cid.toString()}`
    gwUrl.search = '?format=raw'
    try {
      const res = await fetch(gwUrl, {
        headers: {
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

async function getBlock (ipfs, cid, numTry = 1) {
  try {
    const block = await getRawBlock(ipfs, cid)
    return dagCborDecode(block)
  } catch (e) {
    if (numTry < MAX_LOOKUP_RETRIES) {
      return getBlock(ipfs, cid, numTry + 1)
    }
    throw e
  }
}

// Caches for metadata and location table
const metadataCache = new Map()
const locTableCache = new Map()

async function getMetadata (ipfs, rootCid) {
  const key = rootCid.toString()
  if (metadataCache.has(key)) return metadataCache.get(key)
  const meta = await getBlock(ipfs, rootCid)
  metadataCache.set(key, meta)
  return meta
}

async function getLocTable (ipfs, locTableRootCid) {
  const key = locTableRootCid.toString()
  if (locTableCache.has(key)) return locTableCache.get(key)
  const table = await getBlock(ipfs, locTableRootCid)
  locTableCache.set(key, table)
  return table
}

function binaryCompare (a, b) {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  if (a.length < b.length) return -1
  if (a.length > b.length) return 1
  return 0
}

// Traverse prolly tree index to find the entry for a given IP.
// Prolly tree block format:
//   Branch: { branch: [distance, [[key, cid], ...]], closed: bool }
//   Leaf:   { leaf: [[key, value], ...], closed: bool }
// Does a "floor" lookup: find the greatest key <= searchKey.
async function traverseIndex (ipfs, indexRootCid, searchKey) {
  let currentCid = indexRootCid

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const node = await getBlock(ipfs, currentCid)

    if (node.branch) {
      const [, entries] = node.branch
      let idx = 0
      for (let i = entries.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, entries[i][0]) >= 0) {
          idx = i
          break
        }
      }
      currentCid = CID.asCID(entries[idx][1])
      if (!currentCid) throw new Error('Invalid CID in prolly tree branch')
      continue
    }

    if (node.leaf) {
      const entries = node.leaf
      let idx = -1
      for (let i = entries.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, entries[i][0]) >= 0) {
          idx = i
          break
        }
      }
      if (idx < 0) return null
      return { key: entries[idx][0], value: entries[idx][1] }
    }

    throw new Error('Unknown prolly tree node type')
  }
}

async function fetchLocation (ipfs, pageCids, locationId, pageSize) {
  const pageIndex = Math.floor(locationId / pageSize)
  const offsetInPage = locationId % pageSize

  if (pageIndex >= pageCids.length) {
    throw new Error(`Location page index ${pageIndex} out of bounds`)
  }

  const pageCid = CID.asCID(pageCids[pageIndex])
  if (!pageCid) throw new Error(`Invalid page CID at index ${pageIndex}`)

  const page = await getBlock(ipfs, pageCid)
  if (!Array.isArray(page) || offsetInPage >= page.length) {
    throw new Error(`Location entry ${locationId} not found in page`)
  }

  return page[offsetInPage]
}

async function _lookup (ipfs, rootCid, ipstring) {
  const metadata = await getMetadata(ipfs, rootCid)
  const searchKey = uint128ToBytes(ipToUint128(ipstring))

  const indexResult = await traverseIndex(ipfs, metadata.indexRoot, searchKey)
  if (!indexResult) throw new Error('Unmapped range')

  const pageCids = await getLocTable(ipfs, metadata.locationTableRoot)
  const pageSize = metadata.pageSize
  const locationData = await fetchLocation(ipfs, pageCids, indexResult.value, pageSize)

  if (!locationData || locationData === 0) throw new Error('Unmapped range')
  return formatData(locationData)
}

const memoizedLookup = memoize(_lookup, {
  cachePromiseRejection: false,
  cacheKey: args => {
    const [, cid, ipstring] = args
    return `${cid}.${ipstring}`
  }
})

/**
 * @param {object|string|string[]} ipfs
 * @param {string} ipstring
 * @returns {Promise}
 */
export function lookup (ipfs = defaultGateway, ipstring) {
  return memoizedLookup(ipfs, GEOIP_ROOT, ipstring)
}
