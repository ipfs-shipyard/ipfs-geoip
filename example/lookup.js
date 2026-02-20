import * as geoip from '../src/index.js'

const ipfsGw = process?.env?.IPFS_GATEWAY || 'https://ipfs.io'

if (process.argv.length !== 3) {
  console.log('usage: node lookup.js <ip-address>') // eslint-disable-line no-console
  process.exit(1)
}

;(async function () {
  try {
    const result = await geoip.lookup(ipfsGw, process.argv[2])
    console.log('Result: ' + JSON.stringify(result, null, 2)) // eslint-disable-line no-console
  } catch (err) {
    console.log('Error: ' + err) // eslint-disable-line no-console
  }

  // detect protocol for multiaddr
  const proto = process.argv[2].includes(':') ? 'ip6' : 'ip4'
  try {
    const result = await geoip.lookupPretty(ipfsGw, `/${proto}/` + process.argv[2])
    console.log('Pretty result: %s', result.formatted) // eslint-disable-line no-console
  } catch (err) {
    console.log('Error: ' + err) // eslint-disable-line no-console
  }
})()
