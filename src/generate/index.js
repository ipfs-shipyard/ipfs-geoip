'use strict'

const Promise = require('bluebird')
const csv = Promise.promisifyAll(require('csv'))
const iconv = require('iconv-lite')
const ip = require('ip')
const _ = require('lodash')
const EventEmitter = require('events').EventEmitter
const concat = require('it-concat')

const normalizeName = require('./overrides')

// Btree size
const CHILDREN = 32

// All data is stored in an ipfs folder called DATA_HASH
// It includes two files
//
//     DATA_HASH
//     |- locationsCsv
//     |- blocksCsv
const DATA_HASH = 'bafybeid3munsqqt36qhoumn3kvgwmft6dsswzgl3wiohsanlyqemczcsvi' // GeoLite2-City-CSV_20201013
const locationsCsv = 'GeoLite2-City-Locations-en.csv'
const blocksCsv = 'GeoLite2-City-Blocks-IPv4.csv'

const progress = new EventEmitter()

function emit (type, status, attrs) {
  progress.emit('progress', Object.assign({}, {
    type: type,
    status: status
  }, attrs))
}

function parseCountries (locations) {
  emit('countries', 'start')
  return csv.parseAsync(locations, {
    columns: true,
    cast: false,
    skip_empty_lines: true
  })
    .then((parsed) => {
      return _.reduce(parsed, (acc, row) => {
        if (typeof acc[row.country_iso_code] != null) { // eslint-disable-line  valid-typeof
          acc[row.country_iso_code] = normalizeName(row.country_name)
        }
        return acc
      }, {})
    })
    .then((result) => {
      emit('countries', 'end')
      return result
    })
}

function parseLocations (locations, countries) {
  emit('locations', 'start')
  return csv.parseAsync(locations, {
    columns: true,
    cast: false,
    skip_empty_lines: true,
    comment: '#'
  })
    .then((parsed) => {
      return _.reduce(parsed, (acc, row) => {
        acc[row.geoname_id] = [
          countries[row.country_iso_code],
          row.country_iso_code,
          row.subdivision_1_iso_code,
          normalizeName(row.city_name)
        ]
        return acc
      }, {})
    })
    .then((result) => {
      emit('locations', 'end')
      return result
    })
}

function parseBlocks (blocks, locations) {
  emit('blocks', 'start')
  return csv.parseAsync(blocks, {
    columns: true,
    cast: false,
    skip_empty_lines: true,
    comment: '#'
  })
    .then((parsed) => {
      let lastEnd = 0

      return _.reduce(parsed, (acc, row) => {
        const { firstAddress, lastAddress } = ip.cidrSubnet(row.network)
        const start = ip.toLong(firstAddress)
        const end = ip.toLong(lastAddress)

        const { geoname_id } = row // eslint-disable-line camelcase
        const geonameData = locations[geoname_id]

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
          data: geonameData
        })

        lastEnd = end

        return acc
      }, [])
    })
    .then((result) => {
      emit('blocks', 'end')
      return result
    })
}

function putObject (data, min, api) {
  return api.object.put(data, { enc: 'json' })
    .then((cid) => {
      return api.object.stat(cid)
        .then((stat) => {
          if (!stat) {
            throw new Error(`Could not stat object ${cid.toString()}`)
          }
          emit('put', 'end')
          return {
            min: min,
            size: stat.CumulativeSize,
            hash: cid.toString()
          }
        })
    })
}

// Create a btree leaf with data
function createLeaf (data) {
  // TODO: use dag-cbor instead of stringified JSON
  return Buffer.from(JSON.stringify({
    Data: JSON.stringify({
      type: 'Leaf',
      data: data
    })
  }))
}
// Create a btree node with data
function createNode (data) {
  // TODO: use dag-cbor instead of stringified JSON
  return Buffer.from(JSON.stringify({
    Data: JSON.stringify({
      type: 'Node',
      mins: data.map((x) => x.min)
    }),
    Links: data.map((x) => ({
      Hash: x.hash,
      Size: x.size
    }))
  }))
}

function toNode (things, api) {
  const length = things.length

  if (length <= CHILDREN) {
    const first = things[0]
    const min = first.min

    if (!first.hash) {
      return putObject(createLeaf(things), min, api)
    }

    return putObject(createNode(things), min, api)
  }

  // divide
  return Promise.map(_.chunk(things, CHILDREN), (res) => toNode(res, api), {
    concurrency: require('os').cpus().length * 2
  })
    .then((res) => toNode(res, api))
}

async function file (ipfs, dir) {
  // TODO: refactor from Buffer to Uint8Array
  const buffer = await concat(ipfs.cat(`${DATA_HASH}/${dir}`), { type: 'buffer' })
  // source files are in latin1, which requires handling with care
  iconv.skipDecodeWarning = true
  return iconv.decode(buffer, 'latin1')
}

function main (ipfs) {
  return file(ipfs, locationsCsv)
    .then(parseCountries)
    .then((countries) => Promise.join(
      file(ipfs, locationsCsv),
      countries,
      parseLocations
    ))
    .then((locations) => Promise.join(
      file(ipfs, blocksCsv),
      locations,
      parseBlocks
    ))
    .then((result) => {
      emit('node', 'start', {
        length: result.length
      })

      return toNode(result, ipfs)
    })
    .then((result) => {
      emit('node', 'end')
      emit('pinning', 'start')
      return ipfs.pin.add(result.hash, { recursive: true })
    })
    .then((result) => {
      emit('pinning', 'end')
      return result[0].cid.toString()
    })
}

module.exports = {
  parseCountries: parseCountries,
  parseLocations: parseLocations,
  parseBlocks: parseBlocks,
  putObject: putObject,
  toNode: toNode,
  main: main,
  progress: progress
}
