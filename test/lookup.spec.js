/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const geoip = require('../src')
const IPFSFactory = require('ipfsd-ctl')
const factory = IPFSFactory.create({ type: 'js' })

describe('lookup', function () {
  this.timeout(100 * 1000)
  let ipfs

  before((done) => {
    factory.spawn((err, ipfsd) => {
      if (err) throw err
      ipfs = ipfsd.api
      done()
    })
  })

  it('fails on 127.0.0.1', async () => {
    try {
      await geoip.lookup(ipfs, '127.0.0.1')
    } catch (err) {
      expect(err).to.have.property('message', 'Unmapped range')
    }
  })

  it('looks up 8.8.8.8', async () => {
    const result = await geoip.lookup(ipfs, '8.8.8.8')
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
  })

  describe('lookupPretty', () => {
    it('fails on 127.0.0.1', async () => {
      try {
        await geoip.lookupPretty(ipfs, '/ip4/127.0.0.1')
      } catch (err) {
        expect(err).to.have.property('message', 'Unmapped range')
      }
    })

    it('looks up 8.8.8.8', async () => {
      const result = await geoip.lookupPretty(ipfs, '/ip4/8.8.8.8')
      expect(
        result.formatted
      ).to.be.eql('Mountain View, CA, United States, Earth')
    })
  })
})
