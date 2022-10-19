import * as geoip from '../src/index.js'

const ipfsGw = process?.env?.IPFS_GATEWAY || 'https://ipfs.io'

if (process.argv.length !== 3) {
  console.log('usage: node lookup.js <ip4-adr>')
  process.exit(1)
}

(async function() {
  try {
    const result = await geoip.lookup(ipfsGw, process.argv[2])
    console.log('Result: ' + JSON.stringify(result, null, 2))
  } catch (err) {
    console.log('Error: ' + err)
  }

  try {
    const result = await geoip.lookupPretty(ipfsGw, '/ip4/' + process.argv[2])
    console.log('Pretty result: %s', result.formatted)
  } catch (err) {
    console.log('Error: ' + err)
  }
})()
