#!/usr/bin/env bash
# Export fixture blocks needed by tests.
# Requires a running Kubo node with the v2 dataset imported.
#
# Usage: ./bin/load-fixtures.sh
#
# This does a full lookup for each test IP, recording every CID
# fetched, then saves each block to test/fixtures/<cid>.raw.bin

set -euo pipefail

FIXTURES_DIR="test/fixtures"
mkdir -p "$FIXTURES_DIR"

# clear old fixtures
rm -f "$FIXTURES_DIR"/*.raw.bin

save_block() {
  local cid="$1"
  local out="$FIXTURES_DIR/$cid.raw.bin"
  if [ ! -f "$out" ]; then
    curl -sS -H "Accept: application/vnd.ipld.raw" "http://127.0.0.1:8080/ipfs/$cid?format=raw" > "$out"
    echo "  saved $cid ($(wc -c < "$out") bytes)"
  fi
}

echo "Extracting fixture blocks for test IPs..."

CIDS=$(node --input-type=module -e "
import { decode as dagCborDecode } from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { GEOIP_ROOT } from './src/lookup.js'
import { ipToUint128, uint128ToBytes } from './src/ip.js'

const cids = new Set()

async function getBlock(cidObj) {
  const cidStr = cidObj.toString()
  cids.add(cidStr)
  const res = await fetch('http://127.0.0.1:8080/ipfs/' + cidStr + '?format=raw', {
    headers: { Accept: 'application/vnd.ipld.raw' }
  })
  if (!res.ok) throw new Error('fetch failed: ' + cidStr + ' ' + res.status)
  return dagCborDecode(new Uint8Array(await res.arrayBuffer()))
}

function binaryCompare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return a.length - b.length
}

async function traceLookup(ip) {
  const searchKey = uint128ToBytes(ipToUint128(ip))
  const meta = await getBlock(GEOIP_ROOT)

  // traverse index tree
  let cur = CID.asCID(meta.indexRoot)
  let locId
  while (true) {
    const node = await getBlock(cur)
    if (node.branch) {
      const [, entries] = node.branch
      let idx = 0
      for (let i = entries.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, entries[i][0]) >= 0) { idx = i; break }
      }
      cur = CID.asCID(entries[idx][1])
      continue
    }
    if (node.leaf) {
      let idx = -1
      for (let i = node.leaf.length - 1; i >= 0; i--) {
        if (binaryCompare(searchKey, node.leaf[i][0]) >= 0) { idx = i; break }
      }
      if (idx >= 0) locId = node.leaf[idx][1]
      break
    }
    throw new Error('bad node')
  }

  // fetch location table root
  const locTable = await getBlock(CID.asCID(meta.locationTableRoot))

  // fetch the specific page needed for this locId
  const pageSize = meta.pageSize || 256
  const pageIdx = Math.floor(locId / pageSize)
  await getBlock(CID.asCID(locTable[pageIdx]))
}

const testIPs = ['66.6.44.4', '2604:a880:800:a1::']
for (const ip of testIPs) {
  await traceLookup(ip)
}

for (const c of cids) console.log(c)
")

for cid in $CIDS; do
  save_block "$cid"
done

echo "Done. $(ls "$FIXTURES_DIR"/*.raw.bin | wc -l) fixture files."
