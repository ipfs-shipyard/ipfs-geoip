'use strict'

var ipfs = require('ipfs-api')()
var csv = require('csv')
var fs = require('fs')
var Q = require('kew')
var iconv = require('iconv-lite')

var CHILDREN = 32

function parseCountries (file) {
  var def = Q.defer()
  var countries = {}

  fs.readFile(file, function (err, data) {
    if (err) throw err
    csv.parse(data, function (err, parsed) {
      if (err) throw err

      parsed.forEach(function (row) {
        countries[row[1]] = row[0]
      })
      def.resolve(countries)
    })
  })

  return def.promise
}

function parseLocations (file, countries) {
  var def = Q.defer()
  var locations = {}

  fs.readFile(file, function (err, data) {
    if (err) throw err

    csv.parse(iconv.decode(data, 'latin1'), function (err, parsed) {
      if (err) throw err

      parsed.forEach(function (row) {
        var locid = parseInt(row[0], 10)
        var data = row
        data[0] = countries[row[1]]
        locations[locid] = data
      })
      console.log('parsed locations')
      def.resolve(locations)
    })
  })

  return def.promise
}

var ENTRY_COUNT = 0

function parseBlocks (file, locations) {
  var def = Q.defer()
  var entries = []

  fs.readFile(file, function (err, rawdata) {
    if (err) throw err
    csv.parse(rawdata, function (err, parsed) {
      if (err) throw err
      var last_end = 0
      parsed.forEach(function (row) {
        var start = parseInt(row[0], 10)
        var end = parseInt(row[1], 10)
        var locid = parseInt(row[2], 10)

        // unmapped range?
        if ((start - last_end) > 1) {
          ENTRY_COUNT++
          entries.push({min: last_end + 1,
                        data: 0})
        }

        ENTRY_COUNT++
        entries.push({min: start,
                      data: locations[locid]})

        last_end = end
      })
      console.log('parsed blocks')
      def.resolve(entries)
    })
  })

  return def.promise
}

var PROGRESS = 0
// we need a queue not to hammer the api with a gazillion
// requests at the same time
var Queue = Q.resolve()

function putObject (data, min, def) {
  Queue = Queue.then(function () {
    ipfs.object.put(data, 'json', function (err, put) {
      if (err || !put) {
        console.log('error in put:')
        console.log(err, put)
      }

      ipfs.object.stat(put.Hash, function (err, stat) {
        if (err || !stat) {
          console.log('error in stat:')
          console.log(err, stat)
        }

        PROGRESS++
        console.log('approx progress: ' +
                    (((PROGRESS / (ENTRY_COUNT / 32)) * 100) + '').substr(0, 4) + '%')

        def.resolve({min: min,
                     size: stat.CumulativeSize,
                     hash: put.Hash})
      })
    })
  })

  Queue = Queue.delay(20)
}

function toNode (things) {
  var def = Q.defer()
  var length = things.length

  if (length <= CHILDREN) {
    var min = things[0].min
    var data

    if (!things[0].hash) {
      // btree leaf
      var leaf = JSON.stringify({type: 'Leaf',
                                 data: things})

      data = new Buffer(JSON.stringify({Data: leaf}))
    } else {
      // btree node
      var node = JSON.stringify({type: 'Node',
                                 mins: things.map(function (x) { return x.min })})

      data = new Buffer(JSON.stringify({Data: node,
                                        Links: things.map(function (x) {
                                          return {Hash: x.hash,
                                                  Size: x.size}
                                        })}))
    }
    putObject(data, min, def)
  } else {
    // divide

    var promises = []
    var pointer = 0

    while (pointer < length) {
      console.log(pointer / length)
      promises.push(
        toNode(things.slice(pointer, pointer + CHILDREN)))
      pointer += CHILDREN
    }

    Q.all(promises)
      .then(function (results) {
        toNode(results).then(function (result) {
          // done!
          def.resolve(result)
        })
      })
  }

  return def.promise
}

function usage () {
  console.log('usage: node geoip-gen.js blockfile.csv locationfile.csv')
  process.exit(1)
}

function main () {
  parseCountries(process.cwd() + '/../country_data/countries.csv')
    .then(function (countries) {
      parseLocations(process.cwd() + '/' + process.argv[3], countries)
        .then(function (locations) {
          parseBlocks(process.cwd() + '/' + process.argv[2], locations)
            .then(function (entries) {
              toNode(entries).then(function (result) {
                console.log('done!')
                console.log(result.hash)
              })
            })
        })
    })
}

if (process.argv.length !== 4) {
  usage()
} else {
  main()
}
