# DAG layout analysis

Analysis of v2 data format (prolly tree + sharded location table),
based on GeoLite2-City-CSV_20250218 dataset.

## Current v2 structure

- Root metadata: `{ version, indexRoot, locationTableRoot, entryCount, locationCount, pageSize }`
- Prolly tree index: 4 levels, ~49K blocks, 92 MB
  - branching factor (f=64), compact endKey encoding
  - entries: 3,086,445 (after merging adjacent ranges with same location)
  - each entry: `key` (16-byte start IP) -> `[locId, endOffset]` (integer + variable-length bytes)
- Location table: 305 blocks, 3.8 MB
  - root: array of 304 page CIDs (12,467 bytes)
  - pages: 256 locations each (~10-12 KB)

### Lookup cost (with block-level caching)

| Sample size | Blocks fetched | Total bytes |
|-------------|----------------|-------------|
| 10 IPs      |             34 |      235 KB |
| 100 IPs     |            211 |    1,328 KB |
| 500 IPs     |            700 |    4,029 KB |
| 1000 IPs    |          1,164 |    5,896 KB |

### Lookup cost breakdown at n=500

| Category             | Blocks  | Bytes      |
|----------------------|---------|------------|
| Metadata             |       1 |     0.2 KB |
| Index branches       |     170 |   1,134 KB |
| Index leaves         |     387 |   1,199 KB |
| Location table root  |       1 |      12 KB |
| Location pages       |     141 |   1,685 KB |
| **Total**            | **700** | **4,029 KB** |

## Design decisions

### Merge adjacent CIDR ranges

GeoLite2 source data contains many adjacent CIDR ranges mapping to the same
location. During generation, consecutive entries with the same `locId` whose
IP ranges are contiguous (`prevEnd + 1 === currStart`) are merged into a single
entry with extended range. This reduces entry count from 5.0M to 3.1M (38.2%).

### Compact endKey encoding

Instead of storing a full 16-byte endKey per entry, we store the offset
(`endIP - startIP`) as a variable-length byte array (typically 1-4 bytes
instead of 16). The lookup reconstructs the full endKey via
`startKey + minBytesToBigint(offsetBytes)`. This saves ~37 MB in the DAG.

### Fanout = 64 (branching factor)

Tested three fanout values with merge+compact encoding:

| Fanout    | DAG size | 500 IPs: blocks / KB | 1000 IPs: blocks / KB |
|-----------|----------|----------------------|-----------------------|
| f=32      |    95 MB |          886 / 3,319 |           1,468 / 4,863 |
| **f=64**  | **92 MB** |      **700 / 4,029** |     **1,164 / 5,896** |
| f=128     |    90 MB |          606 / 4,938 |             984 / 7,285 |

Chose f=64 because the primary consumer is ipfs-webui and ipfs-desktop where
the Peers tab resolves hundreds of IPs on initial page load and thousands over
the lifetime of a session if kept open. In this scenario:

- f=32 minimizes total bytes but fetches 26% more blocks, increasing HTTP
  round-trip overhead per lookup. At n=1000 it fetches 1,468 blocks vs 1,164.
- f=128 minimizes block count but transfers 22% more bytes because each block
  is larger and most entries in a fetched block are irrelevant to the query.
- f=64 reduces both dimensions consistently vs the unoptimized baseline
  (21% fewer bytes, 11% fewer blocks at n=500) without trading off one for
  the other. For HTTP gateway fetches, keeping both block count and total bytes
  low matters -- round-trips add latency, and bytes add transfer time.

## Comparison with v1

| Metric                    | V1 (B-tree)          | V2 (current)            | Delta                      |
|---------------------------|----------------------|-------------------------|----------------------------|
| Total DAG size            | 253 MB               | 92 MB                   | -64%                       |
| Unique blocks             | 202,445              | 49,484                  | -76%                       |
| IP coverage               | IPv4 only            | IPv4 + IPv6             | added                      |
| Tree depth                | 5                    | 4                       | -1 level                   |
| Entry count               | ~5.4M (incl filler)  | 3,086,445               | -43%                       |
| Unique locations          | duplicated per leaf   | 77,580 (stored once)    | deduplicated               |
| 500 IPs: blocks / bytes   | 991 / 1.27 MB        | 700 / 4.03 MB           | -29% blocks, +3.2x bytes  |

The per-lookup byte cost is still higher than v1 due to 128-bit keys (vs 32-bit)
and explicit range-end storage. v1 had no endKey at all (entries were contiguous
by construction with filler entries). The trade-off is worth it for IPv6 support
and the much smaller total DAG.

## Explored but not applied

### Separate IPv4/IPv6 subtrees with native key widths

IPv4-mapped keys always share 10 zero bytes + `0xffff`. Using 4-byte keys
for IPv4 in a separate subtree saves ~10 bytes/key x ~2M IPv4 entries = ~20 MB.
Adds code complexity (two index trees, routing logic). Marginal gain relative
to the complexity cost.

### Larger location page size

Current: 256 entries/page, 304 pages, root = 12.5 KB.
Increasing to 1024: 76 pages, root = ~3 KB.
Trade-off: larger pages waste more bandwidth per fetch since only one location
per page is needed. At 256 entries the page size (~11 KB) is already reasonable.

### Derive country_name from country_code at lookup time

Saves ~10 bytes/location x 77,580 = ~0.8 MB. Marginal, and would require
bundling a country code mapping table in the client library.
