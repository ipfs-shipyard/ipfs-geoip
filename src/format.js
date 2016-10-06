'use strict'

// TODO(dignifiedquire): Adjust for more planets
const PLANET = 'Earth'

module.exports = function formatData (data) {
  return {
    country_name: data[0],
    country_code: data[1],
    region_code: data[2],
    city: data[3],
    postal_code: data[4],
    latitude: data[5],
    longitude: data[6],
    metro_code: data[7],
    area_code: data[8],
    planet: PLANET
  }
}
