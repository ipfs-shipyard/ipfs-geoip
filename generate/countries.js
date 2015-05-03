fs = require('fs')
csv = require('csv')

fs.readFile("/home/krl/hax/ipfs-geoip/data/countries.csv", function (err, data) {
  var countries = {}
  csv.parse(data, function (err, parsed) {
    parsed.forEach(function (row) {
      if (row[0] != "name") {
        countries[row[1]] = row[0]
      }
    })
    console.log("COUNTRIES = " + JSON.stringify(countries)+";")
  })
})
