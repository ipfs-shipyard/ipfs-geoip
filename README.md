# IPFS GeoIP

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io) [![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/) [![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![Dependency Status](https://david-dm.org/ipfs/ipfs-geoip.svg?style=flat-square)](https://david-dm.org/ipfs/ipfs-geoip)
[![Travis CI](https://travis-ci.org/ipfs/ipfs-geoip.svg?branch=master)](https://travis-ci.org/ipfs/ipfs-geoip)


> *Proof of concept:* Geoip lookup over ipfs


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

There is a generator included, that can be called like this:

```bash
$ node geoip-gen.js path/GeoLite-Blocks.csv path/GeoLite-Location.csv
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

## License

[MIT](LICENSE)
