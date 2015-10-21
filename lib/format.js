'use strict'

// TODO(dignifiedquire): Adjust for more planets
var PLANET = 'Earth'

module.exports = function formatData (data) {
  var obj = {}

  if (data[0]) obj.country_name = data[0]
  if (data[1]) obj.country_code = data[1]
  if (data[2]) obj.region_code = data[2]
  if (data[3]) obj.city = data[3]
  if (data[4]) obj.postal_code = data[4]
  if (data[5]) obj.latitude = parseFloat(data[5])
  if (data[6]) obj.longitude = parseFloat(data[6])
  if (data[7]) obj.metro_code = data[7]
  if (data[8]) obj.area_code = data[8]

  obj.planet = PLANET

  return obj
}
