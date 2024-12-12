/* eslint-env mocha */

import * as chai from 'chai'
import { default as asPromised } from 'chai-as-promised'
import { parse } from 'csv-parse/browser/esm/sync'
import { fromString } from 'uint8arrays/from-string'
import { default as gen } from '../src/generate/index.js'
chai.use(asPromised)
const expect = chai.expect

const locations = fromString(`
geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,subdivision_1_iso_code,subdivision_1_name,subdivision_2_iso_code,subdivision_2_name,city_name,metro_code,time_zone,is_in_european_union
3039163,en,EU,Europe,AD,Andorra,06,"Sant Julià de Loria",,,"Sant Julià de Lòria",,Europe/Andorra,0
12042053,en,AS,Asia,AE,"United Arab Emirates",AZ,"Abu Dhabi",,,"Musaffah City",,Asia/Dubai,0
765876,en,EU,Europe,PL,Poland,06,Lublin,,,Lublin,,Europe/Warsaw,1
5391959,en,NA,"North America",US,"United States",CA,California,,,"San Francisco",807,America/Los_Angeles,0
`)

// the old format had separate files,
// however now we read data from the same CSV as locations
const countries = locations

const blocks = fromString(`
network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider,postal_code,latitude,longitude,accuracy_radius
194.158.92.192/26,3039163,3041565,,0,0,,42.4678,1.5005,100
94.59.56.0/24,12042053,290557,,0,0,,24.3613,54.4803,20
213.195.159.0/24,765876,798544,,0,0,20-128,51.2574,22.5850,200
2.56.139.0/24,5391959,2017370,,0,0,94119,37.7794,-122.4176,1000
`)

describe('generate', () => {
  it('parseCountries', () => {
    return expect(
      gen.parseCountries(parse, countries)
    ).to.eventually.be.eql({
      AD: 'Andorra',
      AE: 'United Arab Emirates',
      PL: 'Poland',
      US: 'USA'
    })
  })

  it('parseLocations', () => {
    return expect(
      gen.parseLocations(parse, locations, {
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
      gen.parseBlocks(parse, blocks, {
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
})
