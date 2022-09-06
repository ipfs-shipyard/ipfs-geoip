import { expect } from 'chai'
import * as geoip from '../src/index.js'
import * as Ctl from 'ipfsd-ctl'
import * as ipfsModule from 'ipfs'

describe('lookup', function () {
  this.timeout(100 * 1000)
  let ipfs
  let ipfsd

  before(async () => {
    ipfsd = await Ctl.createController({
      type: 'proc',
      ipfsModule
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
      region_code: 'VA',
      city: 'Ashburn',
      postal_code: '20103',
      latitude: 39.0019,
      longitude: -77.4556,
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
      ).to.be.eql('Ashburn, VA, USA, Earth')
    })
  })

  after(async () => {
    await ipfsd.stop()
  })
})
