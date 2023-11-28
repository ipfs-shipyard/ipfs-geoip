
import { default as Promise } from 'bluebird'
import * as dagCbor from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import ip from 'ip'
import { chunk, reduce } from 'lodash-es'
import { EventEmitter } from 'events'
import concat from 'it-concat'
import { cpus } from 'os'

import normalizeName from './overrides.js'

// Btree size
const CHILDREN = 32

// All data is stored in an ipfs folder called DATA_HASH
// It includes two files
//
//     DATA_HASH
//     |- locationsCsv
//     |- blocksCsv
const DATA_HASH = 'bafybeifv6fqeyyvratbzewxpasvfxdsnqz5wjv6e6cp36pr5tkccmtljcm' // GeoLite2-City-CSV_20231117
const locationsCsv = 'GeoLite2-City-Locations-en.csv'
const blocksCsv = 'GeoLite2-City-Blocks-IPv4.csv'

const progress = new EventEmitter()

function emit (type, status, attrs) {
  progress.emit('progress', Object.assign({}, {
    type: type,
    status: status
  }, attrs))
}

async function parseCountries (parse, locations) {
  emit('countries', 'start')
  const parsed = parse(locations, {
    columns: true,
    cast: false,
    skip_empty_lines: true
  })
  const result = reduce(parsed, (acc, row) => {
    if (typeof acc[row.country_iso_code] != null) { // eslint-disable-line  valid-typeof
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
  const result = reduce(parsed, (acc, row) => {
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

async function parseBlocks (parse, blocks, locations) {
  emit('blocks', 'start')
  const parsed = parse(blocks, {
    columns: true,
    cast: false,
    skip_empty_lines: true,
    comment: '#'
  })
  let lastEnd = 0
  const result = reduce(parsed, (acc, row) => {
    const { firstAddress, lastAddress } = ip.cidrSubnet(row.network)
    const start = ip.toLong(firstAddress)
    const end = ip.toLong(lastAddress)

    const { geoname_id } = row // eslint-disable-line camelcase
    const geonameData = locations[geoname_id] // eslint-disable-line camelcase

    // conform to legacy input format by filling up missing data the first time
    // a geoname is inspected
    if (Array.isArray(geonameData) && geonameData.length < 7) {
      geonameData.push(
        String(row.postal_code),
        Number(row.latitude),
        Number(row.longitude)
      )
    }

    // unmapped range?
    if ((start - lastEnd) > 1) {
      acc.push({
        min: lastEnd + 1,
        data: 0
      })
    }

    acc.push({
      min: start,
      data: geonameData || 0
    })

    lastEnd = end

    return acc
  }, [])
  emit('blocks', 'end')
  return result
}

async function putBlock (data, min, car) {
  let cid
  try { // eslint-disable-line no-useless-catch
    const bytes = dagCbor.encode(data)
    const hash = await sha256.digest(bytes)
    cid = CID.create(1, dagCbor.code, hash)
    await car.put({ cid, bytes })
  } catch (e) {
    /*
    console.error('failed data')
    console.error(JSON.stringify(data, null, 2))
    */
    throw e
  }
  emit('put', 'end')
  return {
    min,
    cid
  }
}

// Create a btree leaf with data
function createLeaf (data) {
  return { data }
}
// Create a btree node with data
function createNode (data) {
  return {
    mins: data.map((x) => x.min),
    links: data.map((x) => CID.asCID(x.cid)).filter(cid => cid) // valid CID instances are turned into DAG-CBOR links
  }
}

async function toNode (things, car) {
  const length = things.length

  if (length <= CHILDREN) {
    const first = things[0]
    const min = first.min

    if (!first.cid) {
      return putBlock(createLeaf(things), min, car)
    }

    return putBlock(createNode(things), min, car)
  }

  // divide
  return Promise.map(chunk(things, CHILDREN), (res) => toNode(res, car), {
    concurrency: cpus().length * 2
  })
    .then((res) => toNode(res, car))
}

async function file (ipfs, dir) {
  const buffer = await concat(ipfs.cat(`${DATA_HASH}/${dir}`))
  return buffer.toString('utf8')
}

async function main (ipfs, car) {
  const { parse } = await import(process.browser ? 'csv-parse/browser/esm/sync' : 'csv-parse/sync')
  const locations = await file(ipfs, locationsCsv)
  const countries = await parseCountries(parse, locations)
  const locationsWithCountries = await parseLocations(parse, locations, countries)
  const blocks = await file(ipfs, blocksCsv)
  let result = await parseBlocks(parse, blocks, locationsWithCountries)
  emit('node', 'start', { length: result.length })
  result = await toNode(result, car)
  emit('node', 'end')
  return result.cid
}

export default {
  parseCountries: parseCountries,
  parseLocations: parseLocations,
  parseBlocks: parseBlocks,
  putBlock: putBlock,
  toNode: toNode,
  main: main,
  progress: progress
}
