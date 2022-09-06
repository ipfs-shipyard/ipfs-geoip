/* eslint-env mocha */
'use strict'

import { CID } from 'multiformats/cid'
import * as multihash from 'multihashes'

import * as chai from 'chai'
import { default as asPromised } from 'chai-as-promised'
chai.use(asPromised)
const expect = chai.expect

import { default as gen } from '../src/generate/index.js'

const locations = Buffer.from(`
geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,subdivision_1_iso_code,subdivision_1_name,subdivision_2_iso_code,subdivision_2_name,city_name,metro_code,time_zone,is_in_european_union
3039163,en,EU,Europe,AD,Andorra,06,"Sant Julià de Loria",,,"Sant Julià de Lòria",,Europe/Andorra,0
12042053,en,AS,Asia,AE,"United Arab Emirates",AZ,"Abu Dhabi",,,"Musaffah City",,Asia/Dubai,0
765876,en,EU,Europe,PL,Poland,06,Lublin,,,Lublin,,Europe/Warsaw,1
5391959,en,NA,"North America",US,"United States",CA,California,,,"San Francisco",807,America/Los_Angeles,0
`)

// the old format had separate files,
// however now we read data from the same CSV as locations
const countries = locations

const blocks = Buffer.from(`
network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider,postal_code,latitude,longitude,accuracy_radius
194.158.92.192/26,3039163,3041565,,0,0,,42.4678,1.5005,100
94.59.56.0/24,12042053,290557,,0,0,,24.3613,54.4803,20
213.195.159.0/24,765876,798544,,0,0,20-128,51.2574,22.5850,200
2.56.139.0/24,5391959,2017370,,0,0,94119,37.7794,-122.4176,1000
`)

const enc = new TextEncoder()

// identity multihash is useful for inlining data for use in tests
const toIdentityCid = (val) => {
  const bytes = enc.encode(val)
  const mh = multihash.encode(bytes, 'identity')
  return new CID(1, 'dag-pb', mh)
}

describe('generate', () => {
  it('parseCountries', () => {
    return expect(
      gen.parseCountries(countries)
    ).to.eventually.be.eql({
      AD: 'Andorra',
      AE: 'United Arab Emirates',
      PL: 'Poland',
      US: 'USA'
    })
  })

  it('parseLocations', () => {
    return expect(
      gen.parseLocations(locations, {
        AD: 'Andorra',
        AE: 'United Arab Emirates',
        PL: 'Poland',
        US: 'USA'
      })
    ).to.eventually.be.eql({
      765876: [
        'Poland',
        'PL',
        '06',
        'Lublin'
      ],
      3039163: [
        'Andorra',
        'AD',
        '06',
        'Sant Julià de Lòria'
      ],
      5391959: [
        'USA',
        'US',
        'CA',
        'San Francisco'
      ],
      12042053: [
        'United Arab Emirates',
        'AE',
        'AZ',
        'Musaffah City'
      ]
    })
  })

  it('parseBlocks', () => {
    return expect(
      gen.parseBlocks(blocks, {
        765876: [
          'Poland',
          'PL',
          '06',
          'Lublin'
        ],
        3039163: [
          'Andorra',
          'AD',
          '06',
          'Sant Julià de Lòria'
        ],
        5391959: [
          'USA',
          'US',
          'CA',
          'San Francisco'
        ],
        12042053: [
          'United Arab Emirates',
          'AE',
          'AZ',
          'Musaffah City'
        ]
      })
    ).to.eventually.be.eql([
      {
        data: 0,
        min: 1
      },
      {
        data: [
          'Andorra',
          'AD',
          '06',
          'Sant Julià de Lòria',
          '',
          42.4678,
          1.5005
        ],
        min: 3265158337
      },
      {
        data: [
          'United Arab Emirates',
          'AE',
          'AZ',
          'Musaffah City',
          '',
          24.3613,
          54.4803
        ],
        min: 1580939265
      },
      {
        data: 0,
        min: 1580939519
      },
      {
        data: [
          'Poland',
          'PL',
          '06',
          'Lublin',
          '20-128',
          51.2574,
          22.585
        ],
        min: 3586367233
      },
      {
        data: [
          'USA',
          'US',
          'CA',
          'San Francisco',
          '94119',
          37.7794,
          -122.4176
        ],
        min: 37260033
      }
    ])
  })

  /* TODO: test DAG-CBOR
  it('putObject', () => {
    const cid = toIdentityCid('myhash').toString()
    const api = {
      object: {
        put: () => Promise.resolve(new CID(cid)),
        stat: (hash) => Promise.resolve({ CumulativeSize: 5 })
      }
    }

    return expect(
      gen.putObject(['hello'], 3, api)
    ).to.eventually.be.eql({
      min: 3,
      size: 5,
      hash: cid
    })
  })

  it('toNode', () => {
    const api = {
      object: {
        put: (val) => Promise.resolve(toIdentityCid('myhash' + val.length)),
        stat: (hash) => Promise.resolve({ CumulativeSize: hash.toString().length })
      }
    }

    return expect(
      gen.toNode([{
        min: 1,
        data: 0
      }, {
        min: 16777216,
        data: ['Andorra', 'AD', '', '', '', 42.5, 1.5, '', '']
      }], api)
    ).to.eventually.be.eql({
      min: 1,
      size: 22,
      hash: toIdentityCid('myhash147').toString()
    })
  })
  */
})
