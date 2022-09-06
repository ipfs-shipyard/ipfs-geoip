/* eslint-env mocha */
'use strict'

import { expect } from 'chai'
import { formatData as format } from '../src/format.js'

describe('format', () => {
  it('formats with all details present', () => {
    expect(
      format([
        'USA',
        'US',
        'CA',
        'Mountain View',
        '94040',
        37.386,
        -122.0838
      ])
    ).to.be.eql({
      country_name: 'USA',
      country_code: 'US',
      region_code: 'CA',
      city: 'Mountain View',
      postal_code: '94040',
      latitude: 37.386,
      longitude: -122.0838,
      planet: 'Earth'
    })
  })

  it('formats with missing details', () => {
    expect(
      format([
        'USA',
        'US',
        'CA',
        '',
        '',
        37.386,
        -122.0838
      ])
    ).to.be.eql({
      country_name: 'USA',
      country_code: 'US',
      region_code: 'CA',
      city: '',
      postal_code: '',
      latitude: 37.386,
      longitude: -122.0838,
      planet: 'Earth'
    })
  })
})
