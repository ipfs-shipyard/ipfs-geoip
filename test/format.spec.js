/* eslint-env mocha */
'use strict'

const expect = require('chai').expect

const format = require('../src/format')

describe('format', () => {
  it('formats with all details present', () => {
    expect(
      format([
        'United States',
        'US',
        'CA',
        'Mountain View',
        94040,
        37.386,
        -122.0838,
        807,
        650
      ])
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

  it('formats with missing details', () => {
    expect(
      format([
        'United States',
        'US',
        'CA',
        '',
        '',
        37.386,
        -122.0838,
        '',
        ''
      ])
    ).to.be.eql({
      country_name: 'United States',
      country_code: 'US',
      region_code: 'CA',
      city: '',
      postal_code: '',
      latitude: 37.386,
      longitude: -122.0838,
      metro_code: '',
      area_code: '',
      planet: 'Earth'
    })
  })
})
