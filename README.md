# IPFS GeoIP

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![Dependency Status](https://david-dm.org/ipfs/ipfs-geoip.svg?style=flat-square)](https://david-dm.org/ipfs/ipfs-geoip)
[![Travis CI](https://img.shields.io/travis/ipfs/ipfs-geoip/master.svg?style=flat-square)](https://travis-ci.org/ipfs/ipfs-geoip)
[![Coverage Status](https://coveralls.io/repos/github/ipfs/ipfs-geoip/badge.svg?branch=master)](https://coveralls.io/github/ipfs/ipfs-geoip?branch=master)

> geoip lookup over ipfs

## Install

```js
npm install --save ipfs-geoip
```

## Usage

```js
const geoip = require('ipfs-geoip')
const ipfs = require('ipfs-http-client')()

var exampleIp = '89.114.95.36'

geoip.lookup(ipfs, exampleIp, (err, result) => {
  if (err) {
    console.log('Error: ' + err)
  } else {
    console.log('Result: ' + JSON.stringify(result, null, 2))
  }
})

geoip.lookupPretty(ipfs, '/ip4/' + exampleIp, (err, result) => {
  if (err) {
    console.log('Error: ' + err)
  } else {
    console.log('Pretty result: %s', result.formatted)
  }
})
```

## API

### `lookup(ipfs, ip, callback)`

Returns an object of the form

```js
{
  "country_code": "US",
  "country_name": "United States",
  "region_code": "CA",
  "city": "Mountain View",
  "postal_code": "94040",
  "latitude": 37.3860,
  "longitude": -122.0838,
  "metro_code": "807",
  "area_code": "650",
  "planet": "Earth"
}
```

### `lookupPretty(ipfs, multiaddrs, callback)`

Provides the same results as `lookup` with the addition of
a `formatted` property that looks like this: `Mountain View, CA, United States, Earth`.

## b-tree

The utility geoip-gen reads csv files provided from GeoLite, and turns them into a 32-way branching b-tree, which is stored as ipfs json objects.

There is a generator included, that can be run with

```bash
$ npm run generate
```

This takes quite a long time to import, but you only need to do it once globally to use the lookup feature.

## Example

You can find an example of how to use this in [`example/lookup.js`](example/lookup.js), which you can use like this:

```bash
$ node example/lookup.js 8.8.8.8
Result: {
  "country_name": "United States",
  "country_code": "US",
  "region_code": "CA",
  "city": "Mountain View",
  "postal_code": "94040",
  "latitude": 37.386,
  "longitude": -122.0838,
  "metro_code": "807",
  "area_code": "650",
  "planet": "Earth"
}
Pretty result: Mountain View, CA, United States, Earth
```

## Root hash

The current root hash for lookups is `QmRn43NNNBEibc6m7zVNcS6UusB1u3qTTfyoLmkugbeeGJ`.

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-geoip/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

### Want to hack on IPFS?

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

[MIT](LICENSE)
