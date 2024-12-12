import { expect } from 'chai'
import fetch from 'cross-fetch'
import esmock from 'esmock'
import { MAX_LOOKUP_RETRIES } from '../src/constants.js'

describe('[Runner Node]: lookup via HTTP Gateway supporting application/vnd.ipld.raw responses', function () {
  const ipfsGW = process?.env?.IPFS_GATEWAY || 'https://ipfs.io'

  let rewiredGeoIp
  let failedCalls = 0

  beforeEach(async () => {
    failedCalls = 0
  })
  afterEach(() => {
    rewiredGeoIp = null
  })

  it('looks up multiple times before failing', async () => {
    rewiredGeoIp = await esmock('../src/index.js', {}, {
      'cross-fetch': {
        default: (gwUrl, options) => {
          failedCalls++
          throw new Error('mock failure')
        }
      }
    })

    try {
      await rewiredGeoIp.lookup(ipfsGW, '66.6.44.45') // use a different IP to avoid the cache
      // should not reach here
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).to.have.property('message').to.contain('unable to fetch raw block for CID')
    } finally {
      expect(failedCalls).to.equal(MAX_LOOKUP_RETRIES)
    }
  })

  it('returns successfully if MAX_LOOKUP_RETRIES is not reached', async () => {
    rewiredGeoIp = await esmock('../src/index.js', {}, {
      'cross-fetch': {
        default: (gwUrl, options) => {
          if (failedCalls < MAX_LOOKUP_RETRIES - 1) {
            failedCalls++
            throw new Error('mock failure')
          }
          return fetch(gwUrl, options)
        }
      }
    })

    const result = await rewiredGeoIp.lookup(ipfsGW, '66.6.44.44') // use a different IP to avoid the cache
    expect(failedCalls).to.be.greaterThan(1)
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
