# IPFS GeoIP

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![Dependency Status](https://david-dm.org/ipfs/ipfs-geoip.svg?style=flat-square)](https://david-dm.org/ipfs/ipfs-geoip)
[![Travis CI](https://img.shields.io/travis/ipfs-shipyard/ipfs-geoip/master.svg?style=flat-square)](https://travis-ci.org/ipfs-shipyard/ipfs-geoip)
[![](https://data.jsdelivr.com/v1/package/npm/ipfs-geoip/badge)](https://www.jsdelivr.com/package/npm/ipfs-geoip)
[![Coverage Status](https://coveralls.io/repos/github/ipfs/ipfs-geoip/badge.svg?branch=master)](https://coveralls.io/github/ipfs/ipfs-geoip?branch=master)

> geoip lookup over ipfs

## Install

### NPM


```js
npm install --save ipfs-geoip
```

### CDN

Instead of a local installation (and browserification) you may request a [remote copy from jsDelivr](https://www.jsdelivr.com/package/npm/ipfs-geoip):

```html
<!-- loading the minified version using jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/ipfs-geoip@7.0.0/dist/index.min.js"></script>
```

When using prebuilt bundle from CDN, `ipfs-geoip` will be exposed under `window.IpfsGeoip`


## Usage

```js
const geoip = require('ipfs-geoip')
const ipfs = require('ipfs-http-client')()

const exampleIp = '66.6.44.4'

try {
  const result = await geoip.lookup(ipfs, exampleIp)
  console.log('Result: ', result)
} catch (err) {
  console.log('Error: ' + err)
}

try {
  const result = await geoip.lookupPretty(ipfs, '/ip4/' + exampleIp)
  console.log('Pretty result: %s', result.formatted)
} catch (err) {
  console.log('Error: ' + err)
}
```

## API

### `lookup(ipfs, ip)`

Returns a promise that resolves to an object of the form

```js
{
  "country_code": "US",
  "country_name": "USA",
  "region_code": "CA",
  "city": "Mountain View",
  "postal_code": "94040",
  "latitude": 37.3860,
  "longitude": -122.0838,
  "planet": "Earth"
}
```

### `lookupPretty(ipfs, multiaddrs)`

Provides the same results as `lookup` with the addition of
a `formatted` property that looks like this: `Mountain View, CA, United States, Earth`.

## b-tree

The utility geoip-gen reads csv files provided from GeoLite, and turns them into a 32-way branching b-tree, which is stored as ipfs json objects.

**Note:** this library uses old type of ipfs json objects for legacy reasons,
be mindful of that and do not use its code as an example.  Modern code should
use [`dag-cbor`](https://github.com/ipld/specs/blob/master/block-layer/codecs/dag-cbor.md)
and [`ipfs.dag`](https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/DAG.md) API.

There is a generator included, that can be run with

```bash
$ npm run generate
```

This takes quite a long time to import, but you only need to do it once when updating the global index used by the lookup feature.

## Example

You can find an example of how to use this in [`example/lookup.js`](example/lookup.js), which you can use like this:

```bash
$ node example/lookup.js 66.6.44.4
Result: {
  "country_name": "USA",
  "country_code": "US",
  "region_code": "NY",
  "city": "New York",
  "postal_code": "10004",
  "latitude": 40.7126,
  "longitude": -74.0066,
  "planet": "Earth"
}
Pretty result: New York, NY, USA, Earth
```

## Root hash

The current root hash for lookups is defined under `GEOIP_ROOT` in `src/lookup.js`

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-geoip/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

### Want to hack on IPFS?

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

ipfs-geoip is [MIT](LICENSE) licensed.

This library includes GeoLite2 data created by MaxMind, available from [maxmind.com](http://www.maxmind.com).
