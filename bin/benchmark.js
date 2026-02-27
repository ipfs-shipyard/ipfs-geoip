#!/usr/bin/env node
/* eslint no-console: "off" */

// Benchmark script: measure lookup cost for a v2 geoip DAG.
//
// Usage: node bin/benchmark.mjs <root-cid> [--gateway URL] [--seed N]
//
// Generates random IPs, traces lookups via a local gateway, counts
// unique blocks fetched and total bytes by category, then outputs
// JSON results for 10/100/500/1000 IP sample sizes.

import { decode as dagCborDecode } from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { ipv4ToUint128, ipv6ToUint128, uint128ToBytes, bytesToUint128, isLocalIPv4 } from '../src/ip.js'

// -- argument parsing ---------------------------------------------------------

const args = process.argv.slice(2)
if (!args.length || args[0] === '--help') {
  console.error('Usage: node bin/benchmark.mjs <root-cid> [--gateway URL] [--seed N]')
  process.exit(1)
}

const rootCidStr = args[0]
const rootCid = CID.parse(rootCidStr)

let gateway = 'http://127.0.0.1:8080'
let seed = Date.now()

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--gateway' && args[i + 1]) { gateway = args[++i]; continue }
  if (args[i] === '--seed' && args[i + 1]) { seed = Number(args[++i]); continue }
}

// -- simple seeded PRNG (xorshift32) ------------------------------------------

function xorshift32 (s) {
  s ^= s << 13
  s ^= s >>> 17
  s ^= s << 5
  return s >>> 0
}

let rngState = seed >>> 0 || 1

function rand () {
  rngState = xorshift32(rngState)
  return rngState
}

// -- random IP generation -----------------------------------------------------

function randomIPv4 () {
  for (;;) {
    const a = (rand() % 224) + 1 // 1-224 (skip 0.x.x.x and 225+)
    const b = rand() % 256
    const c = rand() % 256
    const d = rand() % 256
    const ip = `${a}.${b}.${c}.${d}`
    if (!isLocalIPv4(ip) && a !== 0 && a < 224) return ip
  }
}

// Well-known IPv6 prefixes with actual GeoLite2 coverage
const IPV6_PREFIXES = [
  '2001:4860:', // Google
  '2606:4700:', // Cloudflare
  '2604:a880:', // DigitalOcean
  '2a00:1450:', // Google EU
  '2a01:4f8:', // Hetzner
  '2600:1f18:', // AWS
  '2400:cb00:', // Cloudflare APAC
  '2001:0db8:' // documentation (may not be mapped, but worth trying)
]

function randomIPv6 () {
  const prefix = IPV6_PREFIXES[rand() % IPV6_PREFIXES.length]
  const g5 = (rand() % 0xffff).toString(16)
  const g6 = (rand() % 0xffff).toString(16)
  const g7 = (rand() % 0xffff).toString(16)
  const g8 = (rand() % 0xffff).toString(16)
  // prefix already has 2-3 groups; pad the rest
  const parts = prefix.replace(/:$/, '').split(':')
  while (parts.length < 4) parts.push('0')
  parts.push(g5, g6, g7, g8)
  return parts.slice(0, 8).join(':')
}

// -- block fetching with tracking ---------------------------------------------

const blockSizes = new Map() // cid string -> byte count
const blockCategories = new Map() // cid string -> category

async function fetchRawBlock (cid) {
  const cidStr = cid.toString()
  if (blockSizes.has(cidStr)) {
    return dagCborDecode(await fetchRawBytes(cid))
  }
  const bytes = await fetchRawBytes(cid)
  blockSizes.set(cidStr, bytes.length)
  return dagCborDecode(bytes)
}

async function fetchRawBytes (cid) {
  const url = `${gateway}/ipfs/${cid}?format=raw`
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.ipld.raw' }
  })
  if (!res.ok) throw new Error(`fetch ${cid}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

function categorize (cidStr, category) {
  if (!blockCategories.has(cidStr)) {
    blockCategories.set(cidStr, category)
  }
}

// -- binary compare -----------------------------------------------------------

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

// -- lookup tracing -----------------------------------------------------------

let metadata = null
let locTable = null

async function traceLookup (ipString, isV6) {
  // load metadata once
  if (!metadata) {
    metadata = await fetchRawBlock(rootCid)
    categorize(rootCid.toString(), 'metadata')
  }

  const ipInt = isV6 ? ipv6ToUint128(ipString) : ipv4ToUint128(ipString)
  const searchKey = uint128ToBytes(ipInt)

  // traverse index tree
  let currentCid = CID.asCID(metadata.indexRoot)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cidStr = currentCid.toString()
    const node = await fetchRawBlock(currentCid)

    if (node.branch) {
      categorize(cidStr, 'index_branch')
      const [, entries] = node.branch
      let idx = 0
      for (let i = entries.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, entries[i][0]) >= 0) { idx = i; break }
      }
      currentCid = CID.asCID(entries[idx][1])
      continue
    }

    if (node.leaf) {
      categorize(cidStr, 'index_leaf')
      let idx = -1
      for (let i = node.leaf.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, node.leaf[i][0]) >= 0) { idx = i; break }
      }
      if (idx < 0) return { hit: false }

      const entry = node.leaf[idx]
      const [locId, endKeyOrOffset] = entry[1]

      // detect compact endKey (offset bytes, length < 16) vs full endKey (16 bytes)
      let endKey
      if (endKeyOrOffset.length < 16) {
        // compact: offset from startKey
        const startInt = bytesToUint128(entry[0])
        let offset = 0n
        for (let i = 0; i < endKeyOrOffset.length; i++) {
          offset = (offset << 8n) | BigInt(endKeyOrOffset[i])
        }
        endKey = uint128ToBytes(startInt + offset)
      } else {
        endKey = endKeyOrOffset
      }

      if (binaryCompare(searchKey, endKey) > 0) return { hit: false }

      // fetch location
      if (!locTable) {
        locTable = await fetchRawBlock(CID.asCID(metadata.locationTableRoot))
        categorize(metadata.locationTableRoot.toString(), 'loc_table_root')
      }

      const pageSize = metadata.pageSize || 256
      const pageIdx = Math.floor(locId / pageSize)
      const pageCid = CID.asCID(locTable[pageIdx])
      await fetchRawBlock(pageCid)
      categorize(pageCid.toString(), 'loc_page')

      return { hit: true }
    }

    throw new Error('Unknown node type')
  }
}

// -- main ---------------------------------------------------------------------

async function runBenchmark () {
  console.error(`Root CID: ${rootCidStr}`)
  console.error(`Gateway: ${gateway}`)
  console.error(`Seed: ${seed}`)

  // generate 1000 random IPv4 + 100 random IPv6
  const ipv4List = []
  for (let i = 0; i < 1000; i++) ipv4List.push(randomIPv4())
  const ipv6List = []
  for (let i = 0; i < 100; i++) ipv6List.push(randomIPv6())

  // combined list: interleave some IPv6 among IPv4
  const allIPs = []
  let v6idx = 0
  for (let i = 0; i < ipv4List.length; i++) {
    allIPs.push({ ip: ipv4List[i], v6: false })
    // insert an IPv6 every 10 IPv4 addresses
    if ((i + 1) % 10 === 0 && v6idx < ipv6List.length) {
      allIPs.push({ ip: ipv6List[v6idx++], v6: true })
    }
  }
  // append any remaining IPv6
  while (v6idx < ipv6List.length) {
    allIPs.push({ ip: ipv6List[v6idx++], v6: true })
  }

  const sampleSizes = [10, 100, 500, 1000]
  const results = {}

  for (const n of sampleSizes) {
    // reset tracking
    blockSizes.clear()
    blockCategories.clear()
    metadata = null
    locTable = null

    const sample = allIPs.slice(0, n)
    let hits = 0
    let misses = 0

    for (const { ip, v6 } of sample) {
      try {
        const r = await traceLookup(ip, v6)
        if (r.hit) hits++
        else misses++
      } catch {
        misses++
      }
    }

    // aggregate by category
    const categories = {}
    for (const [cidStr, cat] of blockCategories) {
      if (!categories[cat]) categories[cat] = { blocks: 0, bytes: 0 }
      categories[cat].blocks++
      categories[cat].bytes += blockSizes.get(cidStr) || 0
    }

    // blocks fetched but not categorized (shouldn't happen, but just in case)
    let totalBlocks = 0
    let totalBytes = 0
    for (const [, size] of blockSizes) {
      totalBlocks++
      totalBytes += size
    }

    results[`n${n}`] = {
      ips: n,
      hits,
      misses,
      totalBlocks,
      totalBytes,
      totalKB: Math.round(totalBytes / 1024),
      categories
    }

    console.error(`n=${n}: ${totalBlocks} blocks, ${Math.round(totalBytes / 1024)} KB, ${hits} hits, ${misses} misses`)
  }

  // output JSON
  console.log(JSON.stringify({
    rootCid: rootCidStr,
    gateway,
    seed,
    timestamp: new Date().toISOString(),
    results
  }, null, 2))
}

runBenchmark().catch(err => {
  console.error(err)
  process.exit(1)
})
