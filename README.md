# IPFS GeoIP

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![Dependency Status](https://david-dm.org/ipfs/ipfs-geoip.svg?style=flat-square)](https://david-dm.org/ipfs/ipfs-geoip)
[![Travis CI](https://img.shields.io/travis/ipfs-shipyard/ipfs-geoip/master.svg?style=flat-square)](https://travis-ci.org/ipfs-shipyard/ipfs-geoip)
[![](https://data.jsdelivr.com/v1/package/npm/ipfs-geoip/badge)](https://www.jsdelivr.com/package/npm/ipfs-geoip)
[![Coverage Status](https://coveralls.io/repos/github/ipfs/ipfs-geoip/badge.svg?branch=master)](https://coveralls.io/github/ipfs/ipfs-geoip?branch=master)

> GeoIP lookup over IPFS


# Table of Contents

- [IPFS GeoIP](#ipfs-geoip)
- [Table of Contents](#table-of-contents)
  - [Install](#install)
    - [NPM](#npm)
    - [CDN](#cdn)
  - [Usage](#usage)
  - [API](#api)
    - [`lookup(ipfs, ip)`](#lookupipfs-ip)
    - [`lookupPretty(ipfs, multiaddrs)`](#lookupprettyipfs-multiaddrs)
  - [Maintenance](#maintenance)
    - [CIDs of the lookup dataset](#cids-of-the-lookup-dataset)
    - [Updating GeoLite2 dataset](#updating-geolite2-dataset)
  - [Testing in CLI](#testing-in-cli)
  - [Contribute](#contribute)
    - [Want to hack on IPFS?](#want-to-hack-on-ipfs)
  - [License](#license)

## Install

### NPM


```js
npm install --save ipfs-geoip
```

### CDN

Instead of a local installation (and browserification) you may request a specific
version `N.N.N` as a [remote copy from jsDelivr](https://www.jsdelivr.com/package/npm/ipfs-geoip):

```html
<script type="module">
  import { lookup } from 'https://cdn.jsdelivr.net/npm/ipfs-geoip@N.N.N/dist/index.min.js';
  const gateway = 'https://ipfs.io'
  console.log(await lookup(gateway, '66.6.44.4'))
</script>
```

The response in the console should look similar to:
```js
{
    "country_name": "USA",
    "country_code": "US",
    "region_code": "VA",
    "city": "Ashburn",
    "postal_code": "20149",
    "latitude": 39.0469,
    "longitude": -77.4903,
    "planet": "Earth"
}
```

## Usage

### With public gateways (default)

If `gateways` is a string or array of strings with public gateway URLs, it will be used for
fetching IPFS blocks as [`application/vnd.ipld.raw`](https://www.iana.org/assignments/media-types/application/vnd.ipld.raw)
and parsing them as DAG-CBOR locally via [@ipld/dag-cbor](https://www.npmjs.com/package/@ipld/dag-cbor):

```js
const geoip = require('ipfs-geoip')
const exampleIp = '66.6.44.4'

const gateways = ['https://ipfs.io', 'https://dweb.link']

try {
  const result = await geoip.lookup(gateways, exampleIp)
  console.log('Result: ', result)
} catch (err) {
  console.log('Error: ' + err)
}

try {
  const result = await geoip.lookupPretty(gateways, '/ip4/' + exampleIp)
  console.log('Pretty result: %s', result.formatted)
} catch (err) {
  console.log('Error: ' + err)
}
```

### With custom block getter function

It is also possible to use it with local or remote IPFS node by passing block getter function, e.g., one that exposes
[`ipfs.block.get` Core JS API](https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/BLOCK.md#ipfsblockgetcid-options):

```js
const geoip = require('ipfs-geoip')
const exampleIp = '66.6.44.4'

const ipfs = require('ipfs-http-client')()

try {
  const getBlock = (cid) => ipfs.block.get(cid)
  const result = await geoip.lookup(getBlock, exampleIp)
  console.log('Result: ', result)
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

## Data Structures

The lookup dataset is stored as [DAG-CBOR](https://ipld.io/specs/codecs/dag-cbor/spec/) blocks on IPFS.
Both IPv4 and IPv6 addresses are supported. IPv4 addresses are mapped into
IPv4-mapped IPv6 space (`::ffff:a.b.c.d`) so that all keys are 128-bit.

A root metadata node ties everything together:

```js
{
  version: 2,              // data format version
  indexRoot: CID,          // root of the prolly tree index
  locationTableRoot: CID,  // root of the sharded location table
  entryCount: Number,      // total index entries (IPv4 + IPv6)
  locationCount: Number,   // unique locations
  pageSize: 256            // entries per location page
}
```

### Prolly tree index

IP-to-location mapping is stored in a [prolly tree](https://web.archive.org/web/20250330043408/https://blog.mauve.moe/posts/prolly-tree-analysis)
(a deterministically-chunked search tree). Each entry maps a 128-bit IP key
(the start of a CIDR range, as a 16-byte `Uint8Array`) to a value of
`[location_id, end_key]` where `end_key` is the last IP in the CIDR range.

Lookup traverses the tree from root to leaf, doing a floor search (greatest
key <= the queried IP) at each level. After finding a match, the queried IP
is checked against `end_key` to verify it falls within the CIDR range.
IPs that fall in gaps between ranges get an "Unmapped range" error.

Block format:

- Branch: `{ branch: [distance, [[key, cid], ...]], closed }`
- Leaf: `{ leaf: [[key, value], ...], closed }`

A typical lookup fetches 3-4 blocks: root metadata, 1-2 branch nodes, and a leaf.

### Sharded location table

Locations are stored in a flat array split into pages of 256 entries each.
The `locationTableRoot` block contains an array of CIDs, one per page.
A `location_id` maps to page `floor(id / 256)`, offset `id % 256`.

Each location entry is an array:

```js
[country_name, country_code, region_code, city, postal_code, latitude, longitude]
```

A lookup fetches two additional blocks: the page CID array and the specific page.

## Maintenance

### CIDs of the lookup dataset

The current root hash for lookups is defined under `GEOIP_ROOT` in `src/lookup.js`.

It is generated from GeoLite2 CSV source files fetched from the `DATA_HASH`
directory defined in `src/generate/index.js`.

### Updating GeoLite2 dataset

Updating the dataset is a two-step process: first fetch fresh CSV files from
MaxMind, then rebuild the lookup index.

#### 1. Fetch new CSV data

Requires a free [MaxMind GeoLite2 account](https://www.maxmind.com/en/geolite2/signup)
and a running IPFS daemon.

```bash
$ MAXMIND_ACCOUNT_ID=<id> MAXMIND_LICENSE_KEY=<key> npm run update-dataset
```

This downloads the latest `GeoLite2-City-CSV` zip, extracts the three needed
CSV files, adds them to IPFS (CIDv1, 1 MiB chunks), exports a
`geolite2-city-csv.car`, and updates `DATA_HASH` in `src/generate/index.js`.

#### 2. Rebuild the lookup index

```bash
$ npm run generate
```

This reads the CSV files from the `DATA_HASH` directory on IPFS, builds the
prolly tree index and sharded location table, and writes all blocks as DAG-CBOR
into `ipfs-geoip.car`.

The root CID is printed to the terminal. It should then be imported to IPFS,
pinned in multiple locations, and stored as the new `GEOIP_ROOT` in
`src/lookup.js`.


## Testing in CLI

It is possible to run tests against a local gateway by passing `IPFS_GATEWAY`:

```console
$ IPFS_GATEWAY="http://127.0.0.1:8080" npm test
```

You can find an example of how to use this in [`example/lookup.js`](example/lookup.js), which you can use like this:

```bash
$ export IPFS_GATEWAY="http://127.0.0.1:8080"
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


## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-geoip/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

### Want to hack on IPFS?

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

ipfs-geoip is [MIT](LICENSE) licensed.

This library includes GeoLite2 data created by MaxMind, available from [maxmind.com](http://www.maxmind.com).
