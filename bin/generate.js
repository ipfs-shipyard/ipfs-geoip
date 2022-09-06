#!/usr/bin/env node
/* eslint no-console: "off",  no-unreachable: "off" */
import Gauge from 'gauge'
import gen from '../src/generate/index.js'
import { create } from 'ipfs-http-client'
import { CarWriter } from '@ipld/car'
import fs from 'fs'
import { Readable } from 'stream'
import { promisify } from 'util'
import { CID } from 'multiformats/cid'

const fsopen = promisify(fs.open)
const fsclose = promisify(fs.close)

function handleNoApi () {
  console.error('No ipfs daemon running. Please start one')
  process.exit(1)
}


const carFilename = 'ipfs-geoip.car'
const ipfs = create()

// -- CLI interaction
ipfs.id()
  .then((id) => {
    if (!id) handleNoApi()
  }, handleNoApi)
  .then(async () => {
    const gauge = new Gauge()
    let length = 0
    let counter = 0
    const fakeRoot = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354') // will be replaced with the real root before writer.close()
    const { writer, out } = await CarWriter.create([fakeRoot])
    Readable.from(out).pipe(fs.createWriteStream(carFilename))

    gen.progress.on('progress', (event) => {
      if (event.type === 'node') {
        length = event.length
      }

      if (event.type === 'put') {
        counter++
        const objects = length / 32
        const completed = counter / objects
        gauge.pulse(`${counter}/${objects.toFixed()} (${(completed * 100).toFixed()}%)`)
        gauge.show('exporting DAG-CBOR objects to a CAR', completed)
      }

      if (event.status === 'start' && event.type !== 'put') {
        gauge.show(event.type)
      }
    })

    gauge.show('Starting', 0.0001)
    const rootCid = await gen.main(ipfs, writer)
    return { rootCid, writer }
  })
  .then(async ({ rootCid, writer }) => {
    const newRoots = [CID.asCID(rootCid)]
    await writer.close()
    const fd = await fsopen(carFilename, 'r+')
    await CarWriter.updateRootsInFile(fd, newRoots)
    await fsclose(fd)
    console.log('Finished with root CID %s, all blocks exported to ' + carFilename, rootCid)
    process.exit(0)
  })
  .catch((err) => {
    console.error(err.stack)
    process.exit(1)
  })
