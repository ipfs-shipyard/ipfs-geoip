/* eslint-env mocha */
'use strict'

const expect = require('chai').expect

const geoip = require('../src')
const IPFS = require('ipfs-api')
const ctl = require('ipfsd-ctl')

describe('lookup', function () {
  this.timeout(100 * 1000)
  let ipfs

  before((done) => {
    ctl.disposable((err, node) => {
      if (err) throw err

      node.startDaemon((err) => {
        if (err) throw err
        ipfs = IPFS(node.apiAddr)
        done()
      })
    })
  })

  it('fails on 127.0.0.1', (done) => {
    geoip.lookup(ipfs, '127.0.0.1', function (err, result) {
      expect(err).to.have.property('message', 'Unmapped range')
      done()
    })
  })

  it('looks up 8.8.8.8', (done) => {
    geoip.lookup(ipfs, '8.8.8.8', function (err, result) {
      if (err) throw err
      expect(
        result
      ).to.be.eql({
        country_name: 'United States',
        country_code: 'US',
        region_code: 'CA',
        city: 'Mountain View',
        postal_code: 94040,
        latitude: 37.386,
        longitude: -122.0838,
        metro_code: 807,
        area_code: 650,
        planet: 'Earth'
      })

      done()
    })
  })

  describe.skip('lookupPretty', () => {
    it('fails on 127.0.0.1', (done) => {
      geoip.lookupPretty(ipfs, '/ip4/127.0.0.1', function (err, result) {
        expect(err).to.have.property('message', 'Unmapped range')
        done()
      })
    })

    it('looks up 8.8.8.8', (done) => {
      geoip.lookupPretty(ipfs, '/ip4/8.8.8.8', function (err, result) {
        if (err) throw err
        expect(
          result.formatted
        ).to.be.eql('Mountain View, CA, United States, Earth')
        done()
      })
    })
  })
})
