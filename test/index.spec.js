/* eslint-env mocha */

var expect = require('chai').expect
var ipfsd = require('ipfsd-ctl')
var geoip = require('../')

var ipfs

describe('geoip', function () {
  this.timeout(60000)
  before(function (done) {
    ipfsd.disposableApi(function (err, api) {
      if (err) return done(err)
      ipfs = api
      done()
    })
  })

  describe('lookup', function () {
    it('works', function (done) {
      geoip.lookup(ipfs, '8.8.8.8', function (err, result) {
        expect(err).to.not.exist
        expect(result).to.have.keys([
          'country_code',
          'country_name',
          'region_code',
          'city',
          'postal_code',
          'latitude',
          'longitude',
          'metro_code',
          'area_code',
          'planet'
        ])

        done()
      })
    })
  })

  describe('lookupPretty', function () {
    it('works', function (done) {
      geoip.lookupPretty(ipfs, '/ip4/8.8.8.8', function (err, result) {
        expect(err).to.not.exist
        expect(result.formatted).to.be.equal('Mountain View, CA, United States, Earth')
      })
    })
  })
})
