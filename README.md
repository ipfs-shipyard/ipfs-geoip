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

and a lookup, for example, in the example directory

```
node lookup.js QmaFjNciRUCdD9PxdLu22rUjMs5hJGDgCstrthrEXw4akB 8.8.8.8
```

which will result in:

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
  "area_code": "650"
}
```
