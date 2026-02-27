# DAG layout analysis (2025-02-18)

How the v2 data format (prolly tree + sharded location table) performs,
measured against GeoLite2-City-CSV_20250218.

## Structure

Three parts, all DAG-CBOR:

- **Root metadata** -- `{ version, indexRoot, locationTableRoot, entryCount, locationCount, pageSize }`
- **Prolly tree index** -- 4 levels deep, ~49K blocks, 92 MB
  - Branching factor f=64, compact endKey encoding
  - 3,086,445 entries (after merging adjacent ranges with same location)
  - Each entry maps a 16-byte start IP to `[locId, endOffset]`
- **Location table** -- 305 blocks, 3.8 MB
  - Root block holds an array of 304 page CIDs (12,467 bytes)
  - Each page holds 256 locations (~10-12 KB)

## Lookup cost

With block-level LRU caching across repeated lookups:

| IPs looked up | Blocks fetched | Total bytes |
|---------------|----------------|-------------|
| 10            |             34 |      235 KB |
| 100           |            211 |    1,328 KB |
| 500           |            700 |    4,029 KB |
| 1000          |          1,164 |    5,896 KB |

Where the bytes go (at 500 IPs):

| Category             | Blocks  | Bytes      |
|----------------------|---------|------------|
| Metadata             |       1 |     0.2 KB |
| Index branches       |     170 |   1,134 KB |
| Index leaves         |     387 |   1,199 KB |
| Location table root  |       1 |      12 KB |
| Location pages       |     141 |   1,685 KB |
| **Total**            | **700** | **4,029 KB** |

## v1 vs v2

| Metric                    | v1 (b-tree)          | v2 (prolly tree)        | Change                     |
|---------------------------|----------------------|-------------------------|----------------------------|
| Total DAG size            | 253 MB               | 92 MB                   | -64%                       |
| Blocks                    | 202,445              | 49,484                  | -76%                       |
| IP coverage               | IPv4 only            | IPv4 + IPv6             | added                      |
| Tree depth                | 5                    | 4                       | -1 level                   |
| Entry count               | ~5.4M (incl filler)  | 3,086,445               | -43%                       |
| Locations                 | duplicated per leaf   | 77,580 (stored once)    | deduplicated               |
| 500 IPs: blocks / bytes   | 991 / 1.27 MB        | 700 / 4.03 MB           | -29% blocks, +3.2x bytes  |

Per-lookup bytes are higher than v1 because keys grew from 32-bit to 128-bit
and v2 stores an explicit range end (v1 had none -- entries were contiguous by
construction with filler). Worth it for IPv6 support and a 64% smaller DAG.

## Design decisions

### Merge adjacent CIDR ranges

GeoLite2 has many adjacent CIDR blocks that point to the same location.
The generator merges them: if two consecutive entries share a `locId` and
their IP ranges touch (`prevEnd + 1 === currStart`), they become one entry.
This cuts entry count from 5.0M to 3.1M (38%).

### Compact endKey encoding

Instead of a full 16-byte endKey per entry, we store the offset
(`endIP - startIP`) as variable-length bytes -- typically 1-4 bytes instead
of 16. The lookup reconstructs the full end via
`startKey + minBytesToBigint(offsetBytes)`. Saves ~37 MB.

### Branching factor f=64

Tested three values with merge+compact encoding:

| Fanout    | DAG size | 500 IPs: blocks / KB | 1000 IPs: blocks / KB |
|-----------|----------|----------------------|-----------------------|
| f=32      |    95 MB |          886 / 3,319 |           1,468 / 4,863 |
| **f=64**  | **92 MB** |      **700 / 4,029** |     **1,164 / 5,896** |
| f=128     |    90 MB |          606 / 4,938 |             984 / 7,285 |

The main consumer is ipfs-webui / ipfs-desktop, where the Peers tab resolves
hundreds of IPs on page load and thousands over a session.

- **f=32** fetches the fewest bytes but 26% more blocks. More HTTP round-trips
  means more latency.
- **f=128** fetches the fewest blocks but 22% more bytes -- each block is bigger
  and most of its entries are irrelevant to the query.
- **f=64** keeps both dimensions low. For HTTP gateway fetches, round-trips add
  latency and bytes add transfer time, so neither should be sacrificed.

## Ideas explored but not used

### Separate IPv4/IPv6 subtrees

IPv4-mapped keys always share 10 zero bytes + `0xffff`. Storing IPv4 entries
with 4-byte keys in a separate subtree saves ~10 bytes/key x ~2M entries = ~20 MB.
Adds complexity (two index trees, routing logic) but could be worth revisiting
if per-lookup byte cost becomes a problem.

### Larger location pages

At 256 entries/page we have 304 pages and a 12.5 KB root.
At 1024: 76 pages, ~3 KB root -- but each page fetch wastes more bandwidth
since only one location per page is needed. 256 already keeps pages at ~11 KB.

### Derive country_name from country_code at lookup time

Saves ~10 bytes/location x 77,580 = ~0.8 MB. Would require bundling a
country-code mapping table in the client library. Not enough savings.
