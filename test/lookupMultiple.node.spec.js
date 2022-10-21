import { decode as dagCborDecode } from '@ipld/dag-cbor'
import esmock from 'esmock'
import { expect } from 'chai'

describe('[Runner Node]: lookup via HTTP Gateway supporting application/vnd.ipld.raw responses', function () {
  const ipfsGW = process?.env?.IPFS_GATEWAY || 'https://ipfs.io'

  it('looks up multiple times before failing', async () => {
    let decodeCallCount = 0
    const rewiredGeoIp = await esmock('../src/index.js', {}, {
      '@ipld/dag-cbor': {
        decode: (...args) => {
          decodeCallCount += 1
          if (decodeCallCount === 1) {
            throw new Error('Decode Failed')
          }
          return dagCborDecode(...args)
        }
      }
    })

    const result = await rewiredGeoIp.lookup(ipfsGW, '66.6.44.4')
    expect(decodeCallCount).to.be.greaterThan(1)
    expect(
      result
    ).to.be.eql({
      country_name: 'USA',
      country_code: 'US',
      region_code: 'VA',
      city: 'Ashburn',
      postal_code: '20149',
      latitude: 39.0469,
      longitude: -77.4903,
      planet: 'Earth'
    })
  })
})
