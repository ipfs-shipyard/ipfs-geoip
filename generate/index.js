'use strict'

const Promise = require('bluebird')
const csv = Promise.promisifyAll(require('csv'))
const iconv = require('iconv-lite')
const _ = require('lodash')
const EventEmitter = require('events').EventEmitter
const bl = require('bl')

// Btree size
const CHILDREN = 32

// All data is stored in an ipfs folder called data
// this is the hash of that folder. It includes three files
//
//     data
//     |- blocks.csv
//     |- countries.csv
//     |- locations.csv
const DATA_HASH = 'QmTMh5Q1CnB9jV774aKCvPSqibwDy9sJmo7BCThD5f1oY3'

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
          row.latitude,
          row.longitude,
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
      var last_end = 0

      return _.reduce(parsed, (acc, row) => {
        var start = row.startIpNum
        var end = row.endIpNum
        var locid = row.locId

        // unmapped range?
        if ((start - last_end) > 1) {
          acc.push({
            min: last_end + 1,
            data: 0
          })
        }

        acc.push({
          min: start,
          data: locations[locid]
        })

        last_end = end

        return acc
      }, [])
    })
    .then((result) => {
      emit('blocks', 'end')
      return result
    })
}

function putObject (data, min, api) {
  return api.object.put(data, 'json')
    .then((put) => {
      return api.object.stat(put.Hash)
        .then((stat) => {
          if (!stat) {
            throw new Error(`Could not stat object ${put.Hash}`)
          }
          emit('put', 'end')
          return {
            min: min,
            size: stat.CumulativeSize,
            hash: put.Hash
          }
        })
    })
}

// Create a btree leaf with data
function createLeaf (data) {
  return new Buffer(JSON.stringify({
    Data: JSON.stringify({
      type: 'Leaf',
      data: data
    })
  }))
}
// Create a btree node with data
function createNode (data) {
  return new Buffer(JSON.stringify({
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
  return ipfs.cat(`${DATA_HASH}/${dir}`)
    .then((buffer) => {
      return new Promise((resolve, reject) => {
        buffer.pipe(bl((err, data) => {
          if (err) return reject(err)
          resolve(data)
        }))
      })
    })
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
      return ipfs.pin.add(result.hash, {recursive: true})
    })
    .then((result) => {
      emit('pinning', 'end')
      return result.Pinned[0]
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
