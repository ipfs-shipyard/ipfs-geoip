'use strict'

const geoip = require('../')
const ipfs = require('ipfs-api')()

if (process.argv.length !== 3) {
  console.log('usage: node lookup.js <ip4-adr>')
  process.exit(1)
}

geoip.lookup(ipfs, process.argv[2], (err, result) => {
  if (err) {
    console.log('Error: ' + err)
  } else {
    console.log('Result: ' + JSON.stringify(result, null, 2))
  }
})

geoip.lookupPretty(ipfs, '/ip4/' + process.argv[2], (err, result) => {
  if (err) {
    console.log('Error: ' + err)
  } else {
    console.log('Pretty result: %s', result.formatted)
  }
})
