/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const geoip = require('../src')

const Ctl = require('ipfsd-ctl')

describe('lookup', function () {
  this.timeout(100 * 1000)
  let ipfs
  let ipfsd

  before(async () => {
    ipfsd = await Ctl.createController({
      type: 'proc',
      ipfsModule: require('ipfs')
    })
    ipfs = ipfsd.api
  })

  it('fails on 127.0.0.1', async () => {
    try {
      await geoip.lookup(ipfs, '127.0.0.1')
    } catch (err) {
      expect(err).to.have.property('message', 'Unmapped range')
    }
  })

  it('looks up 66.6.44.4', async () => {
    const result = await geoip.lookup(ipfs, '66.6.44.4')
    expect(
      result
    ).to.be.eql({
      country_name: 'USA',
      country_code: 'US',
      region_code: 'NY',
      city: 'New York',
      postal_code: '10004',
      latitude: 40.7126,
      longitude: -74.0066,
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

    it('looks up 66.6.44.4', async () => {
      const result = await geoip.lookupPretty(ipfs, '/ip4/66.6.44.4')
      expect(
        result.formatted
      ).to.be.eql('New York, NY, USA, Earth')
    })
  })

  after(async () => {
    await ipfsd.stop()
  })
})
