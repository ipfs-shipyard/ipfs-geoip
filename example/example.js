var geoip = require('../')

if (process.argv.length != 4) {
  console.log("usage: node lookup.js root <ip4-adr>")
  process.exit(1)
}

geoip.lookup(process.argv[2], process.argv[3], function (err, result) {
  if (err) {
    console.log("Error: " + err)
  } else {
    console.log("Result: " + JSON.stringify(result, null, 2))
  }
})
