#!/usr/bin/env node
/* eslint no-console: "off",  no-unreachable: "off" */
'use strict'

const Gauge = require('gauge')
const gen = require('../src/generate')
const ipfs = require('ipfs-http-client')()

function handleNoApi () {
  console.error('No ipfs daemon running. Please start one')
  process.exit(1)
}

// TODO
console.log('Unable to build: src/generate/index.js needs to be refactored to use the latest JS API. PRs welcome: https://github.com/ipfs-shipyard/ipfs-geoip')
process.exit(1)

// -- CLI interaction
ipfs.id()
  .then((id) => {
    if (!id) handleNoApi()
  }, handleNoApi)
  .then(() => {
    const gauge = new Gauge()
    let length = 0
    let counter = 0

    gen.progress.on('progress', (event) => {
      if (event.type === 'node') {
        length = event.length
      }

      if (event.type === 'put') {
        counter++
        const objects = length / 32
        const completed = counter / objects
        gauge.pulse(`${counter}/${objects.toFixed()} (${(completed * 100).toFixed()}%)`)
        gauge.show('importing objects to IPFS', completed)
      }

      if (event.status === 'start' && event.type !== 'put') {
        gauge.show(event.type)
      }
    })

    gauge.show('Starting', 0.0001)
    return gen.main(ipfs)
  })
  .then((hash) => {
    console.log('Finished with root hash %s', hash)
    process.exit(0)
  })
  .catch((err) => {
    console.error(err.stack)
    process.exit(1)
  })
