#!/usr/bin/env node
/* eslint no-console: "off" */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DOWNLOAD_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-City-CSV/download?suffix=zip'
const NEEDED_FILES = [
  'GeoLite2-City-Locations-en.csv',
  'GeoLite2-City-Blocks-IPv4.csv',
  'GeoLite2-City-Blocks-IPv6.csv'
]
const EXTRA_FILES = [
  'COPYRIGHT.txt',
  'LICENSE.txt',
  'README.txt'
]
const GENERATE_INDEX_PATH = path.resolve(__dirname, '..', 'src', 'generate', 'index.js')
const CAR_FILENAME = 'geolite2-city-csv.car'

// -- validation ---------------------------------------------------------------

const licenseKey = process.env.MAXMIND_LICENSE_KEY
const accountId = process.env.MAXMIND_ACCOUNT_ID

if (!accountId) {
  console.error('MAXMIND_ACCOUNT_ID environment variable is required')
  console.error('Find your account ID at https://www.maxmind.com/en/accounts/current/license-key')
  process.exit(1)
}
if (!licenseKey) {
  console.error('MAXMIND_LICENSE_KEY environment variable is required')
  console.error('Get a free license key at https://www.maxmind.com/en/geolite2/signup')
  process.exit(1)
}

try {
  execFileSync('ipfs', ['id'], { stdio: 'pipe' })
} catch {
  console.error('No IPFS daemon running. Please start one with: ipfs daemon')
  process.exit(1)
}

for (const cmd of ['curl', 'unzip']) {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe' })
  } catch {
    console.error(`Required command '${cmd}' not found. Please install it.`)
    process.exit(1)
  }
}

// -- main ---------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipfs-geoip-update-'))
try {
  // 1. Download zip
  const zipPath = path.join(tmpDir, 'geolite2-city-csv.zip')
  console.log('Downloading GeoLite2-City-CSV from MaxMind...')
  execFileSync('curl', [
    '-L', '-f', '-o', zipPath,
    '--connect-timeout', '30',
    '--max-time', '300',
    '-u', `${accountId}:${licenseKey}`,
    DOWNLOAD_URL
  ], { stdio: 'inherit' })

  // 2. Find date stamp from zip listing
  const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' })
  const match = listing.match(/(GeoLite2-City-CSV_(\d{8}))\//)
  if (!match) {
    throw new Error('unexpected zip structure: no GeoLite2-City-CSV_YYYYMMDD directory found')
  }
  const [, zipDirName, dateStamp] = match

  // 3. Extract needed CSV files + LICENSE, COPYRIGHT, README
  console.log(`Extracting ${zipDirName}...`)
  const patterns = [...NEEDED_FILES, ...EXTRA_FILES].map(f => `${zipDirName}/${f}`)
  execFileSync('unzip', ['-o', zipPath, ...patterns, '-d', tmpDir], { stdio: 'inherit' })

  const csvDir = path.join(tmpDir, zipDirName)
  for (const f of NEEDED_FILES) {
    if (!fs.existsSync(path.join(csvDir, f))) {
      throw new Error(`expected file not found in zip: ${f}`)
    }
  }

  // 4. Add to IPFS
  console.log('Adding dataset to IPFS...')
  const cid = execFileSync('ipfs', [
    'add', '-r', '--pin=false', '--cid-version=1', '--chunker=size-1048576', '-Q', csvDir
  ], { encoding: 'utf8' }).trim()
  console.log(`Dataset CID: ${cid}`)

  // 5. Export CAR
  console.log(`Exporting CAR file: ${CAR_FILENAME}`)
  const fd = fs.openSync(CAR_FILENAME, 'w')
  try {
    execFileSync('ipfs', ['dag', 'export', cid], { stdio: ['pipe', fd, 'inherit'] })
  } finally {
    fs.closeSync(fd)
  }

  // 6. Update DATA_HASH in src/generate/index.js
  const src = fs.readFileSync(GENERATE_INDEX_PATH, 'utf8')
  const re = /const DATA_HASH = '[^']+' \/\/ .*/
  if (!re.test(src)) {
    console.error(`Warning: could not locate DATA_HASH in ${GENERATE_INDEX_PATH}`)
    console.error(`Manually set it to: ${cid}`)
  } else {
    const updated = src.replace(re, `const DATA_HASH = '${cid}' // GeoLite2-City-CSV_${dateStamp}`)
    fs.writeFileSync(GENERATE_INDEX_PATH, updated)
    console.log('Updated DATA_HASH in src/generate/index.js')
  }

  // 7. Summary
  console.log(`\nDone! Dataset updated to GeoLite2-City-CSV_${dateStamp}`)
  console.log('\nNext steps:')
  console.log('  1. Review the change:  git diff src/generate/index.js')
  console.log('  2. Run the generator:  npm run generate')
  console.log('  3. Import the CAR:     ipfs dag import ipfs-geoip.car')
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
