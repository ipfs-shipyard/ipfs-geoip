#!/usr/bin/env node
/* eslint no-console: "off",  no-unreachable: "off" */
import fs from 'fs'
import { Readable } from 'stream'
import { promisify } from 'util'
import { CarWriter } from '@ipld/car'
import Gauge from 'gauge'
import { create } from 'kubo-rpc-client'
import { CID } from 'multiformats/cid'
import gen from '../src/generate/index.js'

const fsopen = promisify(fs.open)
const fsclose = promisify(fs.close)

function handleNoApi () {
  console.error('No ipfs daemon running. Please start one')
  process.exit(1)
}

const carFilename = 'ipfs-geoip.car'
const ipfs = create()

async function generate () {
  try {
    const id = await ipfs.id()
    if (!id) handleNoApi()
    const gauge = new Gauge()
    let putCount = 0

    const fakeRoot = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
    const { writer, out } = await CarWriter.create([fakeRoot])
    Readable.from(out).pipe(fs.createWriteStream(carFilename))

    gen.progress.on('progress', (event) => {
      if (event.type === 'put') {
        putCount++
        if (putCount % 100 === 0) {
          gauge.pulse(`${putCount} blocks written`)
        }
      }

      if (event.type === 'dedup') {
        console.log(`Deduplicated ${event.geonames} geonames into ${event.locations} locations`)
      }

      if (event.type === 'blocks-ipv4' && event.status === 'end') {
        console.log(`IPv4 blocks: ${event.count}`)
      }

      if (event.type === 'blocks-ipv6') {
        if (event.status === 'end') console.log(`IPv6 blocks: ${event.count}`)
        if (event.status === 'skip') console.log('IPv6 blocks: skipped (file not found)')
      }

      if (event.type === 'merge' && event.status === 'end') {
        console.log(`Total index entries: ${event.total}`)
      }

      if (event.type === 'location-table' && event.status === 'end') {
        console.log(`Location table: ${event.pages} pages`)
      }

      if (event.status === 'start' && event.type !== 'put') {
        gauge.show(event.type)
      }
    })

    gauge.show('Starting', 0.0001)
    const rootCid = await gen.main(ipfs, writer)
    const newRoots = [CID.asCID(rootCid)]
    await writer.close()
    const fd = await fsopen(carFilename, 'r+')
    await CarWriter.updateRootsInFile(fd, newRoots)
    await fsclose(fd)
    console.log(`\nFinished with root CID ${rootCid}`)
    console.log(`Blocks written: ${putCount}`)
    console.log(`CAR file: ${carFilename}`)
    console.log(`\nUpdate GEOIP_ROOT in src/lookup.js to: ${rootCid}`)
    process.exit(0)
  } catch (err) {
    console.error(err.stack)
    process.exit(1)
  }
}

generate()
