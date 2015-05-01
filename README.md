# geoip lookup over ipfs

Proof of concept

# b-tree

The utility geoip-gen reads csv files provided from GeoLite, and turns them into a 32-way branching b-tree, which is stored as ipfs json objects.

#

includes the generator, that can be called like this:

```bash
node geoip-gen.js path/GeoLite-Blocks.csv path/GeoLite-Location.csv
```

This takes quite a long time to import, but you only need to do it once globally to use the lookup feature.

and a lookup, for example

```
node lookup.js QmaFjNciRUCdD9PxdLu22rUjMs5hJGDgCstrthrEXw4akB 8.8.8.8
```

which will result in:

```js
[ 'US',
  'CA',
  'Mountain View',
  '94040',
  '37.3860',
  '-122.0838',
  '807',
  '650' ]
```
