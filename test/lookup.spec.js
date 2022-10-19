import { expect } from 'chai'
import esmock from 'esmock'
import { decode as dagCborDecode } from '@ipld/dag-cbor'

import * as geoip from '../src/index.js'

describe('lookup via HTTP Gateway supporting application/vnd.ipld.raw responses', function () {
  this.timeout(100 * 1000)

  const ipfsGW = process?.env?.IPFS_GATEWAY || 'https://ipfs.io'

  it('fails on 127.0.0.1', async () => {
    try {
      await geoip.lookup(ipfsGW, '127.0.0.1')
    } catch (err) {
      expect(err).to.have.property('message', 'Unmapped range')
    }
  })

  it('looks up 66.6.44.4', async () => {
    const result = await geoip.lookup(ipfsGW, '66.6.44.4')
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

  it('looks up multiple times before failing', async () => {
    let decodeCallCount = 0
    const rewiredGeoIp = await esmock('../src/index.js', {}, {
      '@ipld/dag-cbor': {
        decode: (...args) => {
          decodeCallCount += 1
          if (decodeCallCount === 1) {
            return Promise.reject(new Error('Decode Failed'))
          }
          if (decodeCallCount === 2) {
            return dagCborDecode(...args)
          }
        }
      }
    })

    await rewiredGeoIp.lookup(ipfsGW, '66.6.44.4')
  })

  describe('lookupPretty', () => {
    it('fails on 127.0.0.1', async () => {
      try {
        await geoip.lookupPretty(ipfsGW, '/ip4/127.0.0.1')
      } catch (err) {
        expect(err).to.have.property('message', 'Unmapped range')
      }
    })

    it('looks up 66.6.44.4', async () => {
      const result = await geoip.lookupPretty(ipfsGW, '/ip4/66.6.44.4')
      expect(
        result.formatted
      ).to.be.eql('Ashburn, VA, USA, Earth')
    })
  })
})
