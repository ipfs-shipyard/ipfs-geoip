'use strict'

const Promise = require('bluebird')
const csv = Promise.promisifyAll(require('csv'))
const iconv = require('iconv-lite')
const _ = require('lodash')
const EventEmitter = require('events').EventEmitter
const concat = require('it-concat')

// Btree size
const CHILDREN = 32

// All data is stored in an ipfs folder called data
// this is the hash of that folder. It includes three files
//
//     data
//     |- blocks.csv
//     |- countries.csv
//     |- locations.csv
const DATA_HASH = 'QmVx8CwTy9bxSd1wbU9r4XpzKgHRQwKdRhDnebPV1kjErV'

const progress = new EventEmitter()

function emit (type, status, attrs) {
  progress.emit('progress', Object.assign({}, {
    type: type,
    status: status
  }, attrs))
}

function parseCountries (countries) {
  emit('countries', 'start')
  return csv.parseAsync(countries.toString(), {
    columns: true,
    skip_empty_lines: true
  })
    .then((parsed) => {
      return _.reduce(parsed, (acc, row) => {
        acc[row.alpha2] = row.name
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
  return csv.parseAsync(iconv.decode(locations, 'latin1'), {
    columns: true,
    auto_parse: true,
    skip_empty_lines: true,
    comment: '#'
  })
    .then((parsed) => {
      return _.reduce(parsed, (acc, row) => {
        acc[row.locId] = [
          countries[row.country],
          row.country,
          row.region,
          row.city,
          row.postalCode,
          Number(row.latitude),
          Number(row.longitude),
          row.metroCode,
          row.areaCode
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
  return csv.parseAsync(blocks.toString(), {
    columns: true,
    auto_parse: true,
    skip_empty_lines: true,
    comment: '#'
  })
    .then((parsed) => {
      var lastEnd = 0

      return _.reduce(parsed, (acc, row) => {
        var start = Number(row.startIpNum)
        var end = Number(row.endIpNum)
        var locid = row.locId

        // unmapped range?
        if ((start - lastEnd) > 1) {
          acc.push({
            min: lastEnd + 1,
            data: 0
          })
        }

        acc.push({
          min: start,
          data: locations[locid]
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
            hash: stat.Hash
          }
        })
    })
}

// Create a btree leaf with data
function createLeaf (data) {
  return Buffer.from(JSON.stringify({
    Data: JSON.stringify({
      type: 'Leaf',
      data: data
    })
  }))
}
// Create a btree node with data
function createNode (data) {
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
    concurrency: 5
  })
    .then((res) => toNode(res, api))
}

function file (ipfs, dir) {
  return concat(ipfs.cat(`${DATA_HASH}/${dir}`))
}

function main (ipfs) {
  return file(ipfs, 'countries.csv')
    .then(parseCountries)
    .then((countries) => Promise.join(
      file(ipfs, 'locations.csv'),
      countries,
      parseLocations
    ))
    .then((locations) => Promise.join(
      file(ipfs, 'blocks.csv'),
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
