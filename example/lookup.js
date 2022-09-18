import * as geoip from '../src/index.js'
import { create } from 'ipfs-http-client'

// This CLI tool requires Kubo RPC on 127.0.0.1:5001 to be running
const ipfs = create(new URL('http://127.0.0.1:5001'))

if (process.argv.length !== 3) {
  console.log('usage: node lookup.js <ip4-adr>')
  process.exit(1)
}

(async function() {
  try {
    const result = await geoip.lookup(ipfs, process.argv[2])
    console.log('Result: ' + JSON.stringify(result, null, 2))
  } catch (err) {
    console.log('Error: ' + err)
  }

  try {
    const result = await geoip.lookupPretty(ipfs, '/ip4/' + process.argv[2])
    console.log('Pretty result: %s', result.formatted)
  } catch (err) {
    console.log('Error: ' + err)
  }
})()
