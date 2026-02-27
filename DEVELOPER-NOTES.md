# Developer notes

## Regenerating test fixtures

Test fixtures are raw DAG-CBOR blocks saved to `test/fixtures/<cid>.raw.bin`.
They need to be regenerated whenever `GEOIP_ROOT` changes.

Requires a running Kubo node with the current dataset imported:

```bash
ipfs dag import ipfs-geoip.car
./bin/load-fixtures.sh
```

The script traces lookups for a set of test IPs, records every CID fetched
along the way, and saves each block as a fixture file.

After regenerating, run the tests to make sure everything passes:

```bash
npm test
```

## Updating the GeoLite2 dataset

See the "Updating GeoLite2 dataset" section in README.md.
