#!/usr/bin/env bash

function main() {
  local CID="$1"
  curl -H "Accept: application/vnd.ipld.raw" "https://ipfs.io/ipfs/$CID?format=raw" > test/fixtures/$CID.raw.bin
}

main "$@"
