import { EventEmitter } from 'events'
import * as dagCbor from '@ipld/dag-cbor'
import concat from 'it-concat'
import * as Block from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { nocache } from 'prolly-trees/cache'
import { create as createProllyMap } from 'prolly-trees/map'
import { bf, binaryCompare } from 'prolly-trees/utils'
import { DATA_FORMAT_VERSION, LOCATION_PAGE_SIZE } from '../constants.js'
import { cidrToRange, uint128ToBytes } from '../ip.js'
import normalizeName from './overrides.js'

// Average branching factor for the prolly tree index.
// Higher = wider nodes, fewer levels, fewer fetches per lookup.
const PROLLY_AVG_FANOUT = 64

// All data is stored in an ipfs folder called DATA_HASH
const DATA_HASH = 'bafybeiggln2inqvokpp7rcjpqaou7v73rknemitrv6bp3q67vimthtsopu' // GeoLite2-City-CSV_20250218
const locationsCsv = 'GeoLite2-City-Locations-en.csv'
const blocksIpv4Csv = 'GeoLite2-City-Blocks-IPv4.csv'
const blocksIpv6Csv = 'GeoLite2-City-Blocks-IPv6.csv'

const progress = new EventEmitter()

function emit (type, status, attrs) {
  progress.emit('progress', Object.assign({}, { type, status }, attrs))
}

async function parseCountries (parse, locations) {
  emit('countries', 'start')
  const parsed = parse(locations, {
    columns: true,
    cast: false,
    skip_empty_lines: true
  })
  const result = parsed.reduce((acc, row) => {
    if (typeof acc[row.country_iso_code] != null) { // eslint-disable-line valid-typeof
      acc[row.country_iso_code] = normalizeName(row.country_name)
    }
    return acc
  }, {})
  emit('countries', 'end')
  return result
}

async function parseLocations (parse, locations, countries) {
  emit('locations', 'start')
  const parsed = parse(locations, {
    columns: true,
    cast: false,
    skip_empty_lines: true,
    comment: '#'
  })
  const result = parsed.reduce((acc, row) => {
    acc[row.geoname_id] = [
      countries[row.country_iso_code],
      row.country_iso_code,
      row.subdivision_1_iso_code,
      normalizeName(row.city_name)
    ]
    return acc
  }, {})
  emit('locations', 'end')
  return result
}

// Assign sequential location_ids and build a location array
// where index = location_id
function deduplicateLocations (geonameLocations) {
  const locationArray = []
  const geonameToLocId = new Map()
  let locId = 0

  for (const [geonameId, data] of Object.entries(geonameLocations)) {
    geonameToLocId.set(geonameId, locId)
    locationArray.push(data)
    locId++
  }

  return { geonameToLocId, locationArray }
}

// Parse IP blocks CSV and produce index entries with 128-bit keys
async function parseBlocks (parse, blocksCsv, geonameLocations, geonameToLocId) {
  emit('blocks', 'start')
  const parsed = parse(blocksCsv, {
    columns: true,
    cast: false,
    skip_empty_lines: true,
    comment: '#'
  })

  const entries = []

  for (const row of parsed) {
    const { geoname_id } = row // eslint-disable-line camelcase
    if (!geoname_id) continue // eslint-disable-line camelcase

    const locId = geonameToLocId.get(geoname_id) // eslint-disable-line camelcase
    if (locId === undefined) continue

    const geonameData = geonameLocations[geoname_id] // eslint-disable-line camelcase

    // fill postal_code, lat, lon on first occurrence per geoname
    if (Array.isArray(geonameData) && geonameData.length < 7) {
      geonameData.push(
        String(row.postal_code),
        Number(row.latitude),
        Number(row.longitude)
      )
    }

    const { first } = cidrToRange(row.network)
    entries.push({
      key: uint128ToBytes(first),
      value: locId
    })
  }

  emit('blocks', 'end')
  return entries
}

async function putBlock (data, car) {
  const bytes = dagCbor.encode(data)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(1, dagCbor.code, hash)
  await car.put({ cid, bytes })
  emit('put', 'end')
  return cid
}

// Chunk location array into pages, store each page as a block,
// then store a root node with an array of page CIDs
async function buildLocationTable (locationArray, car) {
  emit('location-table', 'start')
  const pageCids = []
  const pageCount = Math.ceil(locationArray.length / LOCATION_PAGE_SIZE)

  for (let i = 0; i < pageCount; i++) {
    const start = i * LOCATION_PAGE_SIZE
    const end = Math.min(start + LOCATION_PAGE_SIZE, locationArray.length)
    const page = locationArray.slice(start, end)
    const cid = await putBlock(page, car)
    pageCids.push(cid)
  }

  const locTableRootCid = await putBlock(pageCids, car)
  emit('location-table', 'end', { pages: pageCount })
  return locTableRootCid
}

// Build prolly tree index from sorted entries
async function buildIndexTree (entries, car) {
  emit('index-tree', 'start')

  entries.sort((a, b) => binaryCompare(a.key, b.key))

  const chunker = bf(PROLLY_AVG_FANOUT)

  // in-memory block cache for tree construction
  const blockCache = new Map()
  const get = async (cid) => {
    const bytes = blockCache.get(cid.toString())
    if (!bytes) throw new Error(`Block not found: ${cid}`)
    return Block.decode({ bytes, cid, codec: dagCbor, hasher: sha256 })
  }

  let root
  for await (const node of createProllyMap({
    get,
    compare: binaryCompare,
    list: entries,
    sorted: true,
    chunker,
    codec: dagCbor,
    hasher: sha256,
    cache: nocache
  })) {
    const block = await node.block
    blockCache.set(block.cid.toString(), block.bytes)
    await car.put({ cid: block.cid, bytes: block.bytes })
    emit('put', 'end')
    root = node
  }

  const rootCid = (await root.block).cid
  emit('index-tree', 'end')
  return rootCid
}

async function file (ipfs, dir) {
  const buffer = await concat(ipfs.cat(`${DATA_HASH}/${dir}`))
  return buffer.toString('utf8')
}

async function main (ipfs, car) {
  const { parse } = await import(process.browser ? 'csv-parse/browser/esm/sync' : 'csv-parse/sync')

  // 1. Parse locations
  const locCsv = await file(ipfs, locationsCsv)
  const countries = await parseCountries(parse, locCsv)
  const geonameLocations = await parseLocations(parse, locCsv, countries)

  // 2. Deduplicate locations into sequential table
  const { geonameToLocId, locationArray } = deduplicateLocations(geonameLocations)
  emit('dedup', 'end', {
    geonames: Object.keys(geonameLocations).length,
    locations: locationArray.length
  })

  // 3. Parse IPv4 blocks
  const ipv4Csv = await file(ipfs, blocksIpv4Csv)
  const ipv4Entries = await parseBlocks(parse, ipv4Csv, geonameLocations, geonameToLocId)
  emit('blocks-ipv4', 'end', { count: ipv4Entries.length })

  // 4. Parse IPv6 blocks (if available)
  let ipv6Entries = []
  try {
    const ipv6Csv = await file(ipfs, blocksIpv6Csv)
    ipv6Entries = await parseBlocks(parse, ipv6Csv, geonameLocations, geonameToLocId)
    emit('blocks-ipv6', 'end', { count: ipv6Entries.length })
  } catch {
    emit('blocks-ipv6', 'skip')
  }

  // 5. Merge and sort all index entries
  const allEntries = [...ipv4Entries, ...ipv6Entries]
  allEntries.sort((a, b) => binaryCompare(a.key, b.key))
  emit('merge', 'end', { total: allEntries.length })

  // 6. Build location table
  const locTableRootCid = await buildLocationTable(locationArray, car)

  // 7. Build prolly tree index
  const indexRootCid = await buildIndexTree(allEntries, car)

  // 8. Create root metadata node
  const rootMetadata = {
    version: DATA_FORMAT_VERSION,
    indexRoot: indexRootCid,
    locationTableRoot: locTableRootCid,
    entryCount: allEntries.length,
    locationCount: locationArray.length,
    pageSize: LOCATION_PAGE_SIZE
  }
  const rootCid = await putBlock(rootMetadata, car)
  emit('root', 'end')

  return rootCid
}

export default {
  parseCountries,
  parseLocations,
  deduplicateLocations,
  parseBlocks,
  buildLocationTable,
  buildIndexTree,
  putBlock,
  main,
  progress
}
